package me.cuberoot.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import com.android.billingclient.api.*;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.*;
import java.util.function.Consumer;
import java.util.concurrent.atomic.AtomicBoolean;

/** Store transport only. The server verifies ownership and grants/acknowledges purchases. */
@CapacitorPlugin(name = "GoogleMembership")
public class GoogleMembershipPlugin extends Plugin implements PurchasesUpdatedListener {
    private static final List<String> IDS = Arrays.asList("me.cuberoot.app.membership.monthly", "me.cuberoot.app.membership.yearly");
    private final Handler main = new Handler(Looper.getMainLooper());
    private BillingClient billing;
    private PluginCall purchaseCall;
    private boolean billingFlowOpen;
    private String purchasingProduct;
    private String purchasingAccount;

    @Override public void load() {
        billing = BillingClient.newBuilder(getContext()).setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection().build();
    }
    private void ready(PluginCall call, Runnable action) {
        main.post(() -> {
            if (billing.isReady()) { action.run(); return; }
            AtomicBoolean connecting = new AtomicBoolean(true);
            main.postDelayed(() -> { if (connecting.compareAndSet(true, false)) call.reject("Google Play connection timed out"); }, 20_000);
            billing.startConnection(new BillingClientStateListener() {
                public void onBillingSetupFinished(BillingResult result) {
                    if (!connecting.compareAndSet(true, false)) return;
                    if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) action.run();
                    else call.reject("Google Play unavailable", String.valueOf(result.getResponseCode()));
                }
                public void onBillingServiceDisconnected() { /* Next API call reconnects. */ }
            });
        });
    }
    private ProductDetails.SubscriptionOfferDetails baseOffer(ProductDetails product) {
        List<ProductDetails.SubscriptionOfferDetails> offers = product.getSubscriptionOfferDetails();
        if (offers == null) return null;
        String period = product.getProductId().endsWith(".monthly") ? "P1M" : "P1Y";
        for (ProductDetails.SubscriptionOfferDetails offer : offers) {
            List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
            // Launch exactly the auto-renewing base price displayed; no hidden trials/offers.
            if (offer.getOfferId() == null && phases.size() == 1
                && phases.get(0).getRecurrenceMode() == ProductDetails.RecurrenceMode.INFINITE_RECURRING
                && period.equals(phases.get(0).getBillingPeriod())) return offer;
        }
        return null;
    }
    private void products(PluginCall call, Consumer<List<ProductDetails>> next) {
        AtomicBoolean waiting = new AtomicBoolean(true);
        main.postDelayed(() -> {
            if (!waiting.compareAndSet(true, false)) return;
            if (purchaseCall == call) failPurchase("Google products timed out");
            else call.reject("Google products timed out");
        }, 20_000);
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (String id : IDS) products.add(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(BillingClient.ProductType.SUBS).build());
        billing.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(products).build(), (result, details) -> {
            if (!waiting.compareAndSet(true, false)) return;
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                if (purchaseCall == call) failPurchase("Google products unavailable");
                else call.reject("Google products unavailable");
                return;
            }
            next.accept(details.getProductDetailsList());
        });
    }
    @PluginMethod public void products(PluginCall call) {
        ready(call, () -> products(call, details -> {
            JSArray list = new JSArray();
            for (ProductDetails product : details) {
                ProductDetails.SubscriptionOfferDetails offer = baseOffer(product);
                if (offer == null) continue;
                JSObject item = new JSObject();
                item.put("id", product.getProductId()); item.put("displayName", product.getName());
                item.put("displayPrice", offer.getPricingPhases().getPricingPhaseList().get(0).getFormattedPrice());
                list.put(item);
            }
            JSObject response = new JSObject(); response.put("products", list); call.resolve(response);
        }));
    }
    @PluginMethod public void purchases(PluginCall call) {
        AtomicBoolean waiting = new AtomicBoolean(true);
        main.postDelayed(() -> { if (waiting.compareAndSet(true, false)) call.reject("Google purchase query timed out"); }, 45_000);
        ready(call, () -> billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(), (result, purchases) -> {
            if (!waiting.compareAndSet(true, false)) return;
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { call.reject("Could not query Google purchases"); return; }
            JSArray list = new JSArray();
            for (Purchase purchase : purchases) if (purchase.getProducts().stream().anyMatch(IDS::contains)) list.put(serialize(purchase));
            JSObject response = new JSObject(); response.put("purchases", list); call.resolve(response);
        }));
    }
    @PluginMethod public void purchase(PluginCall call) {
        String id = call.getString("productId"); String account = call.getString("obfuscatedAccountId");
        if (!IDS.contains(id) || account == null || !account.matches("[0-9a-f-]{36}")) { call.reject("Invalid purchase request"); return; }
        ready(call, () -> {
            if (purchaseCall != null || billingFlowOpen) { call.reject("A purchase is already in progress"); return; }
            purchaseCall = call; purchasingProduct = id; purchasingAccount = account;
            // Recovery/renewal belongs in Play subscription management. Do not start a second concurrent plan.
            billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(), (result, owned) -> {
                if (purchaseCall != call) return;
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { failPurchase("Could not query existing subscriptions"); return; }
                if (owned.stream().anyMatch(p -> p.getProducts().stream().anyMatch(IDS::contains))) { failPurchase("Restore or manage your existing Google subscription first"); return; }
                products(call, details -> main.post(() -> {
                    if (purchaseCall != call) return;
                    for (ProductDetails product : details) if (id.equals(product.getProductId())) {
                        ProductDetails.SubscriptionOfferDetails offer = baseOffer(product);
                        if (offer == null) break;
                        BillingFlowParams params = BillingFlowParams.newBuilder().setObfuscatedAccountId(account)
                            .setProductDetailsParamsList(Collections.singletonList(BillingFlowParams.ProductDetailsParams.newBuilder()
                                .setProductDetails(product).setOfferToken(offer.getOfferToken()).build())).build();
                        billingFlowOpen = true;
                        BillingResult launch = billing.launchBillingFlow(getActivity(), params);
                        if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) { billingFlowOpen = false; failPurchase("Could not launch Google purchase"); }
                        return;
                    }
                    failPurchase("Product unavailable");
                }));
            });
            main.postDelayed(() -> { if (purchaseCall == call) failPurchase("Purchase confirmation timed out; restore purchases"); }, 150_000);
        });
    }
    private JSObject serialize(Purchase purchase) {
        JSObject result = new JSObject();
        result.put("purchaseToken", purchase.getPurchaseToken());
        result.put("status", purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED ? "purchased" : "pending");
        AccountIdentifiers account = purchase.getAccountIdentifiers();
        if (account != null) result.put("obfuscatedAccountId", account.getObfuscatedAccountId());
        return result;
    }
    private void failPurchase(String message) {
        if (purchaseCall != null) purchaseCall.reject(message);
        purchaseCall = null;
    }
    @Override public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        billingFlowOpen = false;
        notifyListeners("transactionAvailable", new JSObject());
        if (purchaseCall == null) return;
        if (result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            JSObject response = new JSObject(); response.put("status", "cancelled"); purchaseCall.resolve(response); purchaseCall = null; return;
        }
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || purchases == null) { failPurchase("Google purchase not confirmed; restore purchases"); return; }
        for (Purchase purchase : purchases) {
            AccountIdentifiers account = purchase.getAccountIdentifiers();
            if (purchase.getProducts().contains(purchasingProduct) && account != null && purchasingAccount.equals(account.getObfuscatedAccountId())) {
                purchaseCall.resolve(serialize(purchase)); purchaseCall = null; return;
            }
        }
        failPurchase("Purchase account mismatch");
    }
    @PluginMethod public void manage(PluginCall call) {
        main.post(() -> {
            try {
                getActivity().startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/account/subscriptions?package=me.cuberoot.app")));
                call.resolve();
            } catch (RuntimeException error) { call.reject("Subscription management unavailable"); }
        });
    }
    @Override protected void handleOnDestroy() {
        main.removeCallbacksAndMessages(null);
        failPurchase("App closed; restore purchases");
        if (billing != null) billing.endConnection();
    }
}
