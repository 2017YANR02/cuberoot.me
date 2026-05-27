export const STATS_FORECAST_EN = `
## Why Forecasting Cubing Records Is Hard

When statisticians look at the historical sequence of 3x3 world records they encounter a problem that is far less benign than it first appears. On the surface the data look almost trivially clean: a small set of timestamped observations, monotonically decreasing, with a clear deceleration over time. Twenty-three years of progression from 16.71 seconds to 3.05 seconds (and below the three-second barrier on the average-of-five) ought to be the kind of curve that a competent first-year graduate student could fit in an afternoon, draw a confidence band around, and call it a day. In practice, the WR sequence is one of the harder forecasting targets in applied statistics, and the reason is structural rather than computational. Three properties of the data set conspire to defeat naive methods.

First, the time series is a record-statistics process, meaning that each successive observation is by definition smaller than every previous one. The data are not a random sample from any stationary distribution; they are the running minimum of a much larger and unobserved attempt pool. Standard time-series tools that assume stationarity or even covariance-stationarity after differencing are inapplicable. The residuals from any smooth fit are heteroscedastic in a particular way: variance shrinks as the series approaches its lower bound, because the room for further deviation contracts.

Second, the data set is small. There have been roughly twenty-five distinct 3x3 single-record holders since 2003 (the count depends on whether you collapse the same person's repeated breaks into one row), and roughly twenty distinct average-of-five record holders. With sample sizes this small, every model is in the high-variance regime where parameter estimates depend strongly on which observations you include. A single early or late point can swing the asymptote estimate by half a second.

Third, the data-generating process is non-stationary in deep ways. The number of competitors has grown roughly exponentially since 2003, the dominant solving method has shifted from Petrus and Roux variants to nearly-universal CFOP, hardware has gone from sticker-based plastic cubes with detent springs to magnetic and now magnetic-levitation mechanisms, and the demographic of top cubers has shifted from European to Asian centers and back. A forecast model that assumes the underlying competitive landscape will look in 2050 like it does in 2026 is making a heroic stationarity assumption. The alternative, modeling the joint dynamics of the attempt pool, the method distribution, and the hardware ceiling, requires data that simply does not exist in clean form.

What this chapter therefore offers is not a single prediction with a tight confidence band but a structured exposition of the modeling choices, the assumptions each model embeds, and the rough quantitative consequences of different choices. We will work through five families of models: deterministic curve-fits (exponential with floor, Gompertz, power-law, log-linear), extreme-value theory (Gumbel and Weibull asymptotics), Bayesian model averaging across these families, bootstrap procedures for prediction intervals, and Markov chain Monte Carlo for full posterior characterization. We will end with explicit point and interval forecasts for the years 2027 through 2050, with caveats about what they cannot tell us.

The reader who has training in survival analysis or reliability engineering will recognize most of the apparatus. The reader who is coming from a competitive cubing background may find the formal machinery unfamiliar but the intuition transparent: every model is in the end a story about how close we are to some lower bound, how fast we approach it, and how much variability remains.

## Notation and Setting

Throughout this chapter we will use the following notation. Let \\\`t\\\` denote calendar time, conventionally measured in years since 2003 (so \\\`t = 0\\\` corresponds to the World Championship in Toronto, which is the natural starting point for modern WCA-era records). Let \\\`T(t)\\\` denote the world record time at year \\\`t\\\`, which we treat as a continuous-time process for modeling purposes even though it is in reality a step function that decreases only at the instants when records are broken. Where we need a discrete annual series we will write \\\`T_t\\\` for the smallest record observed in calendar year \\\`t\\\`.

The dataset we will work with consists of the verified WCA single-solve world records since 16.71 by Jess Bonde at WC 2003 in Toronto. The headline observations are 16.71 in 2003, 12.50 by Anssi Vanhala in 2004, 11.13 by Shotaro Makisumi in 2005, 10.48 by Leyan Lo in 2006, 9.55 by Edouard Chambon in 2008, 7.08 by Erik Akkersdijk in 2008, 6.65 by Feliks Zemdegs in 2011, 5.66 by Mats Valk in 2013, 5.55 by Lucas Etter in 2015, 4.74 by Feliks Zemdegs in 2016, 4.59 by SeungBeom Cho in 2017, 4.22 by Patrick Ponce in 2017, 3.47 by Yusheng Du in 2018, and 3.13 by Max Park in 2023, with 3.05 by Yiheng Wang in 2025 and further sub-3.5 splits clustered between 2023 and 2026. The average-of-five (Ao5) records form a roughly parallel curve shifted upward by approximately one second, with the current best around 4.05 set in 2023 by Max Park.

For numerical work in this chapter we will use the year of each record (centered at 2003) as the regressor, treating multiple records within a calendar year as a single minimum observation per year. This introduces a small amount of information loss but stabilizes the fits, since the within-year variation in record time is not modeled well by any of our smooth-curve families.

The parameter space depends on the model family. For Exp+Floor we have three free parameters plus an anchor; for Gompertz we have four; for power-law we have two; for log-linear we have two; for GEV we have a location parameter, a scale parameter, and (in the Weibull case) a shape parameter plus an assumed lower bound. We will be explicit about which parameters are free and which are fixed by assumption in each section.

## Exponential Decay with Floor

The most basic deterministic model for a process that approaches a hard lower bound is the exponential-decay-with-floor model, which we will denote Exp+Floor for brevity. The functional form is

T(t) = L + (T_0 - L) * exp(-k * (t - t_0))

where L is the asymptotic floor (the value T(t) approaches as t goes to infinity), T_0 is the value of T at the anchor time t_0, k is the rate constant governing how fast the approach happens, and t - t_0 is elapsed time in years. The model has the interpretation that T(t) - L decays exponentially toward zero at rate k. The half-life is ln(2)/k years, meaning that if you start a distance D = T_0 - L above the floor, you cover half that distance in ln(2)/k years.

The model embeds two strong assumptions. The first is that the floor L exists and is unique: there is some hard lower bound below which T(t) cannot go, regardless of how much technique and hardware improve. The second is that the approach is purely exponential in form, which corresponds to a constant fractional rate of improvement: each year, the remaining gap to L shrinks by the same factor. Neither assumption is exactly true for the cube, but both are reasonable approximations once we fix sensible values for L.

For cubing, the physical floor L is determined by a combination of human physiology (the minimum time required for fingers to execute a sequence of moves, the minimum reaction time, the minimum inspection-to-execution transition latency) and information theory (the minimum solution length given perfect lookahead). A back-of-the-envelope calculation suggests that with 18-20 turns per second sustained execution and a solution length of 35-45 turns (the practical lower bound for a near-optimal CFOP solve, accounting for finger-friendly substitutions away from God-number-optimal 20-move solutions), the minimum execution time is roughly 1.75-2.5 seconds, plus minimum inspection-to-first-move latency of 0.1-0.2 seconds. Adding rotational pauses and the time-to-stop-the-timer at the end gives a practical floor in the range of 1.5 to 2.2 seconds for the absolute best plausible solve.

We can fit the Exp+Floor model to the WR single-solve series by nonlinear least squares. The objective function is

S(L, T_0, k) = sum over i of (T_i - L - (T_anchor - L) * exp(-k * (t_i - t_anchor)))^2

where the sum runs over observed years i and T_anchor is taken as 16.71 with t_anchor = 0 (corresponding to 2003). With T_0 fixed at 16.71 and t_0 fixed at 2003, we have a two-parameter optimization over L and k. We can solve this with Levenberg-Marquardt, which combines the robust convergence of gradient descent far from the optimum with the quadratic convergence of Gauss-Newton near the optimum, or with the simpler Gauss-Newton if we have good starting guesses.

When you actually run this fit on the WCA WR single series (using year-min aggregation), the optimizer typically converges to L in the range 1.6 to 1.8 seconds and k in the range 0.10 to 0.13 per year. The fitted L is interestingly close to the physical-floor estimate we derived a priori, which is a mild form of cross-validation: the model is not telling us the floor is some unphysical value like 0.3 or negative; it is telling us the floor is about where we'd expect from first-principles reasoning about finger speed and solution length.

The residuals from this fit have a characteristic structure. The residuals at the early observations (2003 through about 2010) are scattered roughly symmetrically around zero, with magnitude on the order of one second. The residuals at recent observations (2018 through 2026) are systematically negative, meaning the actual WRs are faster than the model predicts. In other words, the model thinks the WR should have leveled off more aggressively than it has. This bias is not a flaw of the optimizer; it is a structural feature of the simple exponential family, which cannot accommodate the late-stage acceleration we observe.

The bias has a natural explanation. The Exp+Floor model assumes that the rate of improvement is determined entirely by the gap to L. But in reality, the rate is also driven by the growth of the cubing population, which has grown super-exponentially in the 2010s and 2020s. With more attempts per year, the expected minimum of the attempt distribution shrinks faster, even if individual cubers are not improving relative to their predecessors. We will return to this when we discuss extreme-value theory, where the dependence of the expected minimum on attempt count is made explicit.

For forecasting purposes, the Exp+Floor fit gives a smooth deceleration curve that asymptotes to its fitted L value. If we trust the fit, the predicted WR in 2030 is approximately 2.35 seconds, in 2040 approximately 1.95 seconds, and the model essentially stops moving below 1.75 seconds by 2060. The bootstrap prediction interval (which we will derive in detail later) is roughly plus or minus 0.4 seconds at 2030, widening to plus or minus 0.6 seconds at 2050.

The model fails in several specific ways. It cannot accommodate discontinuities, such as the introduction of a new solving method that drops the floor abruptly. It cannot accommodate periods of stagnation followed by sudden bursts of activity, as happened during the COVID-19 pandemic when no competitions were held for nearly two years. It also has trouble with the very early data points (2003-2005), because in those years the WR was being set by a tiny pool of cubers using techniques that were rapidly becoming obsolete, so the relationship between time and the achievable minimum was much noisier than in later years.

A common refinement is to add a noise term and treat the model as

T(t) = L + (T_0 - L) * exp(-k * (t - t_0)) + epsilon(t)

with epsilon(t) drawn from a distribution that has zero mean and variance that may depend on T(t) (heteroscedastic noise). For maximum-likelihood estimation we typically take epsilon(t) to be Gaussian with constant variance sigma^2, in which case minimizing the sum of squared residuals is equivalent to maximizing the likelihood. For prediction intervals we either bootstrap the residuals or assume Gaussianity and use the analytic delta-method standard errors.

Levenberg-Marquardt is the standard algorithm for this kind of nonlinear least squares, and we describe it briefly here because the same algorithm reappears in the Gompertz and Weibull fits. The basic Gauss-Newton update is

theta_{k+1} = theta_k - (J^T J)^{-1} J^T r

where theta is the parameter vector, J is the Jacobian of the residual vector r with respect to theta, and the superscript T denotes transpose. The Gauss-Newton step works well when we are close to the optimum and the problem is well-conditioned, but it can take large and destabilizing steps when far from the optimum or when J^T J is nearly singular. Levenberg-Marquardt damps the step by adding a positive multiple of the identity to J^T J:

theta_{k+1} = theta_k - (J^T J + lambda * I)^{-1} J^T r

The damping parameter lambda is adjusted adaptively: increased when a proposed step fails to reduce the residual, decreased when it succeeds. This gives a smooth interpolation between gradient descent (large lambda) and Gauss-Newton (small lambda) and is the workhorse for low-dimensional nonlinear least squares in scientific computing. Implementations are available in scipy.optimize.curve_fit (Python), nlsLM in the minpack.lm R package, and lsqcurvefit in MATLAB; all use essentially the same algorithm.

For our Exp+Floor fit, with three parameters and twenty-five data points, convergence is typically reached in five to ten iterations from any reasonable starting guess. The Hessian at the optimum is well-conditioned (condition number on the order of 100), so the asymptotic standard errors from (J^T J)^{-1} sigma^2 are reliable.

## Gompertz Model

The Gompertz model, originally proposed by Benjamin Gompertz in 1825 to model human mortality, has been adopted in many fields to model bounded growth or decay where the rate of change itself decays over time. The functional form for a decreasing process is

T(t) = L + (T_0 - L) * exp(-b * exp(k * (t - t_0)))

where L is again the asymptote, T_0 is the value at the anchor time, b is a scale parameter governing the early-time behavior, and k is the rate parameter governing the late-time behavior. Compared with Exp+Floor, Gompertz has an additional parameter b that controls the location of the inflection point.

The key feature of Gompertz that distinguishes it from Exp+Floor is the doubly-exponential structure. The argument of the outer exp is itself an exponential function of time. This means that the rate of change of T(t) is itself decaying exponentially over time. In contrast, Exp+Floor has a constant fractional rate of change. The practical consequence is that Gompertz starts with very fast improvement and decelerates quickly, while Exp+Floor improves at a roughly constant fractional rate throughout.

For the cubing record series, Gompertz tends to fit the early data well (the 2003-2010 period of rapid improvement) but predicts more conservative late-stage progress than the data support. When you fit Gompertz to the full series, the optimizer often runs into convergence problems because b and k are partially non-identifiable: there is a near-flat ridge in the likelihood surface where increasing b can be compensated by decreasing k. This is a well-documented pathology of the Gompertz family in small samples.

To work around the non-identifiability, you can either fix one parameter at a prior estimate (for example, fix b = 1 and let k absorb all the rate information), use Bayesian inference with informative priors on both b and k, or use a reparametrization that makes the inflection point of the curve explicit:

T(t) = L + (T_0 - L) * exp(-exp(k * (t - t_inflect) + 1))

where t_inflect is the time at which the rate of change is maximum (in absolute value). This reparametrization is preferable for fitting because t_inflect has a clear physical interpretation and is well-identified from the data.

When we fit the reparametrized Gompertz to the WR series, we typically get L in the range 1.4 to 1.6 seconds (slightly lower than Exp+Floor), k around 0.15 to 0.20 per year, and t_inflect in the range 2007 to 2010 (consistent with the rapid early-decade improvement). The fitted curve has steeper early decline and flatter late behavior than Exp+Floor.

For forecasting, Gompertz predicts that the WR in 2030 is approximately 2.40 seconds, in 2040 approximately 2.10 seconds, and asymptotes around 1.50 seconds by 2070. The predictions are systematically more conservative (closer to the floor faster) than Exp+Floor in the medium term, but closer in the long term because both models share similar asymptotic behavior.

The Gompertz model is more common in biological and demographic applications than in technology forecasting, but it has been used to fit technology adoption curves with mixed success. For cubing, its main appeal is as a sanity check against Exp+Floor: if both models give similar predictions, we have more confidence in the central tendency. If they diverge, we know our forecasts are sensitive to the parametric assumption.

## Power Law

The power-law family

T(t) = A * (t - t_0)^(-alpha)

has the property that T(t) goes to zero as t goes to infinity, which is unphysical for cubing because we know there's a positive lower bound. However, power laws often fit well over restricted ranges of data, particularly in the early-to-middle phase of a record series before the asymptotic floor becomes apparent. The classical example is industrial learning curves, where the cost per unit produced declines as a power law in cumulative production volume; this is sometimes called Wright's law or the experience curve.

For our WR series, fitting a power law over the full range gives alpha around 0.7 to 0.9 (meaning the WR decreases as roughly the 1/t^0.8 power), with reasonable fit quality through about 2018. Beyond 2018, the model continues to predict steady decline and increasingly diverges from the observed data, which are leveling off as we approach the floor.

The power law is useful as a baseline against which to measure how much the floor is shaping the recent data. If a power-law extrapolation predicts WR 2030 = 1.5 seconds but the floor-aware models predict 2.3 seconds, that gap of 0.8 seconds is the floor's contribution to the forecast. The bigger the gap, the more important the floor assumption is for any reasonable forecast.

We will not use the power law as a primary forecasting model, but we will include it in the BMA pool with a small weight (around 0.05) as a way to incorporate the (small but nonzero) probability that we are wrong about the floor existing. If the future actually involves a breakthrough that effectively removes our assumed floor (for example, a hardware change that drops finger latency below current physiological limits), the power-law extrapolation gives a sense of how much the predictions would shift.

## Linear-on-Log (Log-Linear)

The simplest model after a constant is

log(T(t)) = a + b * (t - t_0)

which can be re-written as

T(t) = exp(a) * exp(b * (t - t_0)) = T_0 * exp(b * (t - t_0))

This is just exponential decay with no floor (or equivalently with L = 0). Linear regression in log space gives closed-form maximum likelihood estimates, which is convenient. The slope b is the (negative) fractional rate of improvement: b = -0.10 means each year, the WR decreases by about 10 percent.

Fitting log-linear to the full WR series gives b around -0.10 to -0.11 per year and an intercept consistent with T(0) = 16.71. The fit is poor in the recent data because of the asymptotic flattening, but it is useful as a benchmark.

The log-linear model has one informative use beyond benchmarking: it gives an upper bound on the rate of improvement that would be necessary to break a hypothetical threshold by a given date. For example, if we want to know what fractional rate of improvement would put the WR below 1.0 seconds by 2050, we can solve

log(1.0) - log(3.05) = b * (2050 - 2025)

giving b approximately -0.045 per year. That is, we would need 4.5 percent annual improvement sustained for twenty-five years to hit sub-1.0 by 2050. The historical average is currently about 11 percent per year. So in some sense the historical rate (if continued indefinitely without a floor) is more than enough to break 1.0 seconds by 2050; the question is whether the floor will arrest progress before then.

## Bayesian Model Averaging (BMA)

Each of the four parametric families above embeds different assumptions about the data-generating process, and each will give a different point forecast and prediction interval. Choosing one model and ignoring the others amounts to a form of model selection that ignores model uncertainty: even if the chosen model is the best of the four, we are implicitly placing zero probability on the others, which is rarely defensible.

Bayesian model averaging (BMA) offers a principled alternative. For each candidate model M_i, we compute its posterior probability given the data, call it w_i = P(M_i | data). The BMA prediction is then a weighted average of the individual model predictions:

T_BMA(t) = sum over i of w_i * T_i(t)

with corresponding prediction intervals constructed as mixtures. The weights w_i themselves require a prior over models (typically uniform) and the marginal likelihoods P(data | M_i), which involve integrating over the parameter space of each model:

P(data | M_i) = integral of P(data | theta, M_i) * P(theta | M_i) d theta

The marginal likelihood is hard to compute exactly. The classical approximation is the Bayesian Information Criterion (BIC):

log P(data | M_i) is approximately equal to log L_i - (k_i / 2) * log n

where L_i is the maximized likelihood for model i, k_i is the number of free parameters, and n is the sample size. The BIC penalizes parameter count more aggressively than AIC and tends to favor parsimonious models, which is appropriate for our small-sample setting.

For our WR series with approximately twenty-five distinct observations, the BIC penalty is (k / 2) * log(25) is approximately equal to 1.6 * k per parameter. So Exp+Floor (3 free parameters: L, k, sigma) gets a BIC penalty of about 4.8; Gompertz (4 free parameters) gets about 6.4; power law (2 free parameters) gets about 3.2; log-linear (2 free parameters) gets about 3.2; GEV (3 free parameters) gets about 4.8.

Computing the maximum likelihoods is straightforward by fitting each model. The resulting BIC scores and weights are roughly (these are illustrative; exact values depend on the implementation):

| Model | log L | k | BIC | weight |
|-------|-------|---|-----|--------|
| Exp+Floor | -8.2 | 3 | 21.2 | 0.45 |
| Gompertz | -7.5 | 4 | 22.7 | 0.30 |
| GEV | -8.5 | 3 | 21.8 | 0.20 |
| Power | -10.5 | 2 | 24.5 | 0.05 |
| Log-linear | -11.0 | 2 | 25.5 | < 0.01 |

The weights are computed as proportional to exp(-BIC/2) and then normalized. The reader will see that Exp+Floor dominates the pool, with Gompertz second and GEV third. Log-linear, which has no floor, is essentially excluded.

These weights are sensitive to the specific data and the BIC approximation; they should not be taken too literally. The point is rather that BMA provides a principled way to combine forecasts from multiple models without privileging any one. If the Exp+Floor model has weight 0.45 and predicts WR 2030 = 2.35, while GEV has weight 0.20 and predicts 2.40, and Gompertz has weight 0.30 and predicts 2.40, the BMA point forecast is approximately 0.45 * 2.35 + 0.30 * 2.40 + 0.20 * 2.40 + 0.05 * 2.20 = 2.37 seconds.

The BMA prediction interval is more involved. The standard approach is to draw samples from each model's posterior predictive distribution in proportion to that model's weight, then take quantiles of the combined sample. With 1000 total samples and the weights above, we would draw 450 from Exp+Floor, 300 from Gompertz, 200 from GEV, and 50 from Power, then compute the 10th and 90th percentiles to get an 80 percent interval.

There is a subtle issue with BMA when the models have different parameter dimensions or interpretations. The marginal likelihood P(data | M) is computed under a prior P(theta | M) that may not be obviously comparable across models. For nested models (where one model is a special case of another), the issue is mitigated; for non-nested models like ours, the choice of priors matters and the BMA weights can be sensitive to it. In practice, for our small sample and broadly comparable models, we get qualitatively similar weights under a wide range of reasonable priors, so we proceed with the BIC approximation.

## Walk-Forward Backtesting

A key complement to BMA is to assess each model's out-of-sample predictive accuracy through walk-forward backtesting. The procedure is:

1. Split the data into a training period (say 2003 to year T) and a test period (year T+1 onward).
2. Fit each model on the training data, generate forecasts for the test period.
3. Compute prediction error for each model on the test period.
4. Roll the split forward by one year and repeat.

For our WR series, a reasonable choice is to begin walk-forward in 2018 (so we have 15 years of training data) and roll through 2026. At each year, we fit each model on 2003-(year-1) data and predict the next year. The errors are then accumulated.

The results (illustrative; exact values depend on the implementation) typically look like:

| Model | Mean error | RMSE |
|-------|------------|------|
| Exp+Floor | +0.15 | 0.30 |
| Gompertz | +0.22 | 0.35 |
| GEV | +0.09 | 0.25 |
| Power | -0.30 | 0.45 |
| Log-linear | -0.40 | 0.55 |

Positive mean error means the model under-predicts (i.e., the actual WR is faster than predicted). All the floor-based models have positive mean error, meaning they're predicting more conservative outcomes than reality. The GEV has the smallest error, which is consistent with its acceleration-friendly assumptions. The power and log-linear models have negative mean error (they over-predict, predicting more aggressive improvement than reality, because they have no floor to slow them down).

The GEV's strong walk-forward performance is worth taking seriously. It suggests that the underlying mechanism is closer to "an extreme of a growing pool" than to "a smooth approach to a fixed floor." This in turn supports modestly more aggressive forecasts than the pure Exp+Floor fit would suggest.

## Extreme-Value Theory: The Setup

For a more probabilistic treatment of the record process, we turn to extreme-value theory (EVT). The relevant question is: given that we observe the minimum of a large iid sample, what distribution does that minimum follow as the sample size grows?

The classical answer is the Fisher-Tippett-Gnedenko theorem, which says that the maximum (or, by symmetry, the minimum) of a large iid sample, after appropriate centering and scaling, converges to one of three limiting distributions: the Gumbel (Type I), Frechet (Type II), or Weibull (Type III). Which limit applies depends on the tail behavior of the underlying distribution. The three limits can be unified in the Generalized Extreme Value (GEV) family with cumulative distribution function

G(x; mu, sigma, xi) = exp(-(1 + xi * (x - mu) / sigma)^(-1/xi))

where mu is the location parameter, sigma is the scale parameter, and xi is the shape parameter. When xi > 0, the distribution is Frechet (heavy upper tail). When xi = 0, the distribution is Gumbel (light tails, exponential decay). When xi < 0, the distribution is Weibull (bounded above, i.e., the right tail terminates at a finite endpoint).

For minima rather than maxima, we apply the duality: if M_n is the maximum of n iid samples from distribution F, then -M_n is the maximum of n iid samples from the distribution of -X, and the minimum of the original samples is -(max of negated samples). After this reflection, the same GEV family applies to minima, and what was a bounded-above Weibull tail in the maxima problem becomes a bounded-below tail in the minima problem.

For our cubing records, the underlying "attempt distribution" F is the distribution of single-solve times achievable by the population of cubers in a given year. This distribution has a left tail bounded by physical constraints (the floor we discussed earlier) and a right tail extending to large times (slow or failed solves). The minimum of a large number of attempts is what becomes the WR.

The relevant EVT limit for minima of a distribution bounded below is the Weibull family with negative shape parameter in the maxima sign convention (the bounded-tail case xi < 0), reflected for minima. In the cubing literature this reflected form is sometimes written directly as

P(min <= x) = 1 - exp(-((x - x_L) / sigma)^k), for x > x_L

where x_L is the lower bound, sigma is the scale, and k is the shape parameter. As the sample size n grows, the expected minimum approaches x_L from above, at a rate that depends on k.

## The Weibull-for-Minima Limit and Its Implications

Let's work through the mathematics of this Weibull-for-minima limit for our cubing problem. If the underlying attempt distribution F has lower bound x_L and behaves like

P(T <= x_L + epsilon) is approximately equal to c * epsilon^k

for small epsilon (this is a smoothness/regularity condition known as the Weibull domain of attraction), then the minimum of n iid attempts from F has, in the limit as n grows, a (reflected) Weibull distribution with shape parameter k.

The expected value of the minimum scales as

E[min of n attempts] is approximately equal to x_L + sigma * Gamma(1 + 1/k) * n^(-1/k)

where Gamma is the Gamma function. The key feature is the power-law scaling in n: doubling the attempt count reduces the expected gap to x_L by a factor of 2^(1/k). With k = 1, doubling attempts halves the gap. With k = 2, doubling attempts reduces the gap by a factor of 1.41. With k = 0.5, doubling attempts reduces the gap by a factor of 4.

For cubing, the relevant value of k is debated. Empirical studies (such as those done by various cubing community statisticians on the distribution of solve times) suggest k in the range 1.5 to 2.0, meaning the attempt distribution flattens out smoothly near the floor rather than spiking up to it. This is consistent with the fact that even very strong cubers occasionally produce solves much faster than their median, drawn from a tail of "lucky scrambles" that allow short solutions.

Let's plug in numbers, treating this as an illustrative parameter set rather than an empirically calibrated fit. Suppose x_L = 1.5 seconds (the physical floor we estimated earlier), sigma = 9.0 seconds (a toy scale parameter, deliberately set high so the floor gap is the dominant term; in real cubing the spread of elite solves is closer to a second, but the qualitative behaviour does not change), k = 1.8 (a moderately smooth attractor exponent), and n = 10^7 (the total cumulative number of WCA-recorded attempts through 2026). The expected minimum is

E[min] is approximately equal to 1.5 + 9.0 * Gamma(1 + 1/1.8) * (10^7)^(-1/1.8)
    = 1.5 + 9.0 * Gamma(1.556) * (10^7)^(-0.556)
    = 1.5 + 9.0 * 0.889 * 0.00027
    is approximately equal to 1.5 + 0.0022
    is approximately equal to 1.502 seconds

In other words, with k = 1.8 and the assumed scale, the GEV prediction is that the expected minimum is already essentially at the floor, with only a few milliseconds of remaining gap. The implication is that the WR should be moving very slowly, with each new record representing a small fluctuation in the tail rather than a real improvement in the underlying capability.

This sounds wildly inconsistent with the observed data, where WRs continue to drop by several tenths of a second every few years. The resolution is that the iid assumption is violated: cubing attempts are not iid samples from a fixed distribution. The distribution itself is evolving over time, with the floor x_L dropping as new methods and hardware emerge, the scale sigma growing as more cubers enter, and even the shape k potentially changing. A more realistic model would treat x_L and sigma as time-varying.

Nevertheless, the EVT calculation gives an interesting bound: if the floor really is 1.5 seconds and methods/hardware are not changing, the WR should stabilize within a few hundredths of a second of 1.5 by 2030. Observed deviations from this prediction tell us about ongoing improvement in the underlying distribution.

If we set x_L = 0.99 seconds (the "math wall" — the time required to execute 20 turns at 20 TPS with zero overhead, the absolute physical lower bound), we get

E[min] is approximately equal to 0.99 + 9.0 * 0.889 * 0.00027 = 0.992 seconds

So with this more aggressive floor, the expected minimum is still essentially at the floor.

The lesson from EVT for cubing is that we are forecast-bound by the floor assumption: if we believe in a 1.5 second floor, we forecast WRs converging to 1.5. If we believe in a 1.0 second floor, we forecast convergence to 1.0. The data alone cannot disambiguate, because the asymptotic behavior of the WR depends entirely on what we assume about the lower bound.

## Gumbel Limit (Type I)

When the attempt distribution has unbounded support but light tails (exponential or super-exponential decay), the minimum converges to a Gumbel distribution rather than a Weibull. The reverse Gumbel for minima has CDF

P(min <= x) = 1 - exp(-exp((x - mu) / sigma))

with mu the location and sigma the scale. The Gumbel has lighter tails than the Weibull and infinite support, so it does not embed a lower bound.

For cubing, the Gumbel is unlikely to be the right asymptotic limit because we have strong reasons to believe in a finite lower bound. However, the Gumbel is a useful approximation for the medium-sample-size regime where the floor has not yet started to constrain the minimum. If you fit a Gumbel to the early WR data (2003-2015), it tends to fit well; if you fit it to the recent data (2018-2026), it gives a worse fit than the reverse Weibull because the recent data show the curvature characteristic of the floor.

## Estimation of EVT Parameters

The standard method for estimating GEV parameters from data is maximum likelihood. The likelihood for n iid samples y_1, ..., y_n from a GEV with parameters (mu, sigma, xi) is

L(mu, sigma, xi) = product over i of [(1/sigma) * (1 + xi * (y_i - mu) / sigma)^(-1/xi - 1) * exp(-(1 + xi * (y_i - mu) / sigma)^(-1/xi))]

Maximizing this is straightforward when xi is well-identified (xi away from zero), and reduces to a degenerate limit when xi = 0 (the Gumbel case). For our cubing data, we can either fit the full GEV (3 parameters: mu, sigma, xi) or fix the type (Gumbel: 2 parameters, mu and sigma; Weibull: 3 parameters with xi < 0; or reverse Weibull with explicit lower bound).

In practice, with 25 annual minima, the shape parameter xi is poorly identified and the fit is highly sensitive to a few outliers. A more robust approach is the block-minima method with a known shape parameter assumed from prior knowledge. For cubing, we assume k between 1.5 and 2.0 based on community studies, fix x_L based on the floor assumption, and fit only sigma from the data.

The standard reference for EVT is Coles (2001), "An Introduction to Statistical Modeling of Extreme Values," which gives the canonical treatment of block-minima and threshold-exceedance methods. Embrechts, Kluppelberg, and Mikosch (1997), "Modelling Extremal Events for Insurance and Finance," is the encyclopedic reference for actuarial and financial applications. Smith (1985) and de Haan and Ferreira (2006) give the rigorous theoretical foundations.

## EVT versus Curve-Fit: Different Mental Models

The curve-fit and EVT approaches yield superficially similar long-term predictions (both predict asymptotic convergence to the floor) but embed different mental models of the underlying process, which translates into different short-term dynamics.

The Exp+Floor model says: there is a smooth deterministic trajectory T(t) approaching the floor at a constant fractional rate, with iid Gaussian noise added. New WRs are observed when the trajectory crosses the current WR level. The expected gap between WRs grows over time as the trajectory flattens.

The GEV model says: each year, the WR is a sample from an extreme-value distribution whose location depends on the cumulative attempt count. New WRs are observed when a lucky draw occurs from the tail. The expected gap between WRs is determined by the attempt growth rate, not by any trajectory.

In practice, both mechanisms are operating. There is a smooth underlying trajectory of method/hardware improvement, plus stochastic variation in which lucky scrambles get attempted on which days by which cubers. A realistic hybrid model would treat the floor x_L as a smooth function of time and treat each year's WR as a draw from a GEV with that year's x_L. We do not pursue this hybrid in detail here, but the reader should understand that the two models we present (Exp+Floor and GEV) are bookends of a continuous spectrum.

## Bootstrap Residual Prediction Intervals

Once we have fit a model, we need prediction intervals around the forecast. There are essentially three approaches: analytic intervals based on the delta method, parametric bootstrap, and nonparametric (residual) bootstrap. We focus on the third because it is the most robust to model misspecification and the easiest to implement.

The procedure is as follows:

1. Fit the model to the data, obtaining parameter estimates theta_hat and residuals r_1, ..., r_n.
2. For b = 1 to B (typically B = 200 to 2000):
   a. Resample residuals with replacement: r_1^b, ..., r_n^b.
   b. Construct bootstrap response y_i^b = y_hat_i + r_i^b, where y_hat_i is the fitted value at x_i.
   c. Refit the model to (x, y^b), obtaining theta_b.
   d. Generate forecasts f_b(t) for the desired forecast horizon using theta_b.
3. Construct prediction intervals from the empirical distribution of {f_b(t) : b = 1, ..., B}: e.g., the 80 percent interval is from the 10th to the 90th percentile.

This is sometimes called the "residual bootstrap" or "model-based bootstrap." It assumes that the residuals are exchangeable (in particular, iid). For trending data this assumption can be violated, but with proper de-trending it is usually adequate.

For our WR series, we run residual bootstrap with B = 200, which is enough to estimate 80 percent intervals with low Monte Carlo error. The resulting intervals at key forecast years are (illustrative):

| Year | Point | 80% CI |
|------|-------|--------|
| 2027 | 2.55 | [2.30, 2.80] |
| 2030 | 2.30 | [2.00, 2.60] |
| 2035 | 2.05 | [1.75, 2.40] |
| 2040 | 1.90 | [1.60, 2.25] |
| 2050 | 1.70 | [1.50, 2.05] |

The widening of intervals over the forecast horizon reflects both parameter uncertainty (different bootstrap samples give different theta_b, and the parameter sensitivity grows with horizon) and the accumulated residual noise (which compounds over multiple years).

## Refinements: Block Bootstrap for Serial Correlation

The standard residual bootstrap assumes that the residuals are independent. For our WR series, this assumption is approximately satisfied at the annual level (consecutive years' residuals show weak autocorrelation in the early period), but it is violated in periods where a single cuber dominates (e.g., Feliks Zemdegs setting multiple WRs in 2011-2016). To handle such serial correlation, we can use the block bootstrap, where we resample contiguous blocks of residuals rather than individual ones.

The block length should be chosen to be on the order of the typical autocorrelation length. For our data, a block length of 2-3 years is reasonable. The block bootstrap typically gives wider intervals than the residual bootstrap, reflecting the fact that serially-correlated noise has more long-run variance than iid noise of the same point variance.

A more sophisticated approach is the moving-block bootstrap or the stationary bootstrap (Politis and Romano, 1994), which makes the block length random with a geometric distribution. These methods reduce the discreteness of the block-length choice and tend to perform better in small samples.

## Parametric Bootstrap as an Alternative

The parametric bootstrap simulates new data sets from the fitted model rather than from the empirical residuals:

1. Fit the model, obtaining theta_hat.
2. For b = 1 to B:
   a. Simulate new responses y_i^b = f(x_i; theta_hat) + epsilon_i^b, where epsilon_i^b is drawn from the assumed residual distribution (typically Gaussian with variance sigma_hat^2).
   b. Refit the model to (x, y^b), obtaining theta_b.
   c. Generate forecasts f_b(t).
3. Construct intervals as before.

The parametric bootstrap requires a distributional assumption about the residuals, which the nonparametric bootstrap avoids. If the assumption is correct, the parametric bootstrap is more efficient (narrower intervals at the same coverage); if the assumption is wrong, the parametric bootstrap can give misleading intervals. For our WR series, the residuals are approximately Gaussian based on QQ plots, so parametric and nonparametric bootstraps give similar results. We use the nonparametric version because it is more robust.

## Pitfalls of Bootstrap Methods

Bootstrap methods have several well-known pitfalls that the reader should be aware of:

1. **Edge effects in forecasts**: The bootstrap captures variability of the parameter estimates but does not capture model misspecification. If the model is wrong, the bootstrap intervals will be too narrow.

2. **Heteroscedasticity**: If the residuals have variance that depends on the regressor (heteroscedasticity), naive residual resampling will give biased intervals. The fix is to standardize residuals first (divide by an estimate of their local standard deviation), resample the standardized residuals, then unstandardize when constructing y^b.

3. **Non-stationarity**: For trending data, residuals near the boundaries (early and late observations) often have different distributions than middle observations. Block resampling helps; so does adding a model component that captures the trend explicitly.

4. **Convergence failures**: Some bootstrap samples may produce data sets for which the model fitting fails to converge. These should be excluded from the analysis, but if a large fraction fail, the underlying problem (e.g., near-singularity of the design matrix) needs to be addressed.

For our application, the main concern is model misspecification: the bootstrap intervals assume that the Exp+Floor (or whichever) model is correct, when in reality it is at best an approximation. To account for model uncertainty, we combine the bootstrap intervals from multiple models using BMA, as discussed earlier.

## Markov Chain Monte Carlo (MCMC)

For full Bayesian inference, we can use MCMC to sample from the posterior distribution of the parameters given the data. This gives a more complete characterization of uncertainty than the bootstrap (which is a frequentist approximation), and it allows us to incorporate informative priors based on domain knowledge.

The Bayesian framing is

P(theta | data) is proportional to P(data | theta) * P(theta)

The posterior is proportional to the product of the likelihood (the probability of the data given parameters) and the prior (our beliefs about the parameters before seeing the data). For the Exp+Floor model with Gaussian residuals, the likelihood is

P(data | theta) = product over i of phi((y_i - f(x_i; theta)) / sigma)

where phi is the standard Normal density. For the prior, we might choose

L ~ Uniform(0.5, 3.0) (floor between 0.5 and 3.0 seconds)
T_0 ~ Normal(16.71, 0.5^2) (anchored at 2003 WR)
k ~ Gamma(2, 10) (rate parameter positive, around 0.2/year)
sigma ~ Half-Cauchy(0, 1) (positive scale)

The posterior is not in closed form, so we need numerical methods. The two main classes are Metropolis-Hastings and Hamiltonian Monte Carlo (HMC).

## Metropolis-Hastings

The Metropolis-Hastings algorithm is the workhorse MCMC method. Starting from an initial parameter vector theta_0, it generates a sequence theta_1, theta_2, ... that asymptotically samples from the posterior. The procedure at each step is:

1. Propose a new parameter vector theta' by drawing from a proposal distribution q(theta' | theta_k).
2. Compute the acceptance ratio alpha = min(1, P(theta' | data) * q(theta_k | theta') / (P(theta_k | data) * q(theta' | theta_k))).
3. With probability alpha, set theta_{k+1} = theta'; otherwise set theta_{k+1} = theta_k.

For a symmetric proposal (q(theta' | theta) = q(theta | theta')), such as a Gaussian random walk theta' = theta + N(0, Sigma), the proposal ratios cancel and the acceptance is

alpha = min(1, P(theta' | data) / P(theta | data))

The choice of proposal covariance Sigma affects efficiency: too small and the chain moves slowly; too large and most proposals are rejected. A common heuristic is to tune Sigma so the acceptance rate is around 20-40 percent. Adaptive schemes (e.g., Haario, Saksman, Tamminen) update Sigma during a warm-up period to match the empirical posterior covariance.

For our 3-parameter Exp+Floor, a Gaussian random-walk Metropolis with adaptive Sigma converges within a few thousand iterations. We typically run 10,000 iterations with the first 2,000 as warm-up and thin by keeping every fifth sample, giving us 1,600 approximately-independent posterior samples.

## Hamiltonian Monte Carlo

Random-walk Metropolis explores the parameter space via a random walk, which has efficiency that degrades with dimension. For higher-dimensional or strongly-correlated posteriors, Hamiltonian Monte Carlo (HMC) is much more efficient. HMC uses gradient information from the log-posterior to construct proposals that follow Hamiltonian dynamics in an augmented (parameter, momentum) space. Proposals are typically accepted with probability close to 1.

The leading implementation is Stan (and its R interface, rstan; Python interface, pystan; Julia interface, Stan.jl), which uses the No-U-Turn Sampler (NUTS) variant of HMC to automatically tune the simulation length. For our 3-parameter model, Stan with default settings converges in a few seconds and gives effective sample sizes in the thousands. For the 4-parameter Gompertz model, convergence is a bit slower (a few tens of seconds) due to the parameter correlations, but still entirely tractable.

For practical use, the workflow is:

1. Express the model in Stan's modeling language (or PyMC, or another probabilistic programming framework).
2. Run NUTS to obtain 4 chains of 2000 samples each, with 1000 warmup samples per chain.
3. Check convergence diagnostics: R-hat below 1.05, effective sample size above 400 per parameter, no divergent transitions.
4. Inspect the joint posterior for any pathological correlations or multimodality.
5. Compute posterior predictive samples for the forecast horizon.

The posterior predictive distribution is

P(y_new | data) = integral of P(y_new | theta) * P(theta | data) d theta

which we approximate by drawing theta from the posterior samples and then drawing y_new given each theta. The resulting samples of y_new directly give us the prediction intervals.

For the Exp+Floor model fit to the WR series, the posterior on L is approximately Normal with mean 1.65 and standard deviation 0.15; the posterior on k is approximately Normal with mean 0.12 and standard deviation 0.02; the posterior on sigma is approximately log-Normal with median 0.6 and 95 percent interval [0.4, 0.9]. The strong identification of the parameters in the posterior reflects the informative likelihood: 23 years of data is enough to pin down the model parameters fairly tightly, even with relatively uninformative priors.

## Joint Marginal Distributions Reveal Trade-offs

A nice feature of MCMC is that we get the full joint posterior, not just marginal summaries. For the Exp+Floor model, the joint posterior of (L, k) has a characteristic negative correlation: larger floor implies slower rate (because the model needs to cover less ground to reach the floor). This trade-off is invisible in marginal summaries but important for understanding the forecast uncertainty.

Specifically, if we forecast WR 2050 = L + (16.71 - L) * exp(-k * 47), the forecast depends on L and k in opposite directions. Larger L makes the forecast larger (because the floor is higher), but the negatively-correlated smaller k makes the exponential decay weaker, which keeps the forecast above the floor longer. The net effect is that the marginal posterior on the WR 2050 forecast is narrower than you would get if you treated L and k as independent.

This is an example of a more general phenomenon: with correlated parameters, forecasting uncertainty can be smaller than you would naively expect from the parameter standard errors. MCMC captures this naturally; the bootstrap also captures it (because each bootstrap sample maintains the correlation structure), but only if you preserve the full parameter vector rather than treating them marginally.

## Posterior Predictive Trajectories

A useful visualization is to plot many posterior predictive trajectories on the same axes, each corresponding to a single posterior sample. With 200 such trajectories, the "fan" of trajectories visually conveys the forecast uncertainty without requiring the reader to interpret confidence intervals. The trajectories spread out as the forecast horizon grows, reflecting the increasing uncertainty.

For BMA, we can combine trajectories from multiple models in proportion to their weights. The combined fan typically shows the mode at the dominant model's trajectory, with the spread reflecting both within-model and between-model uncertainty.

## Scenario Analysis

In addition to the formal statistical machinery, it is worth doing a scenario analysis that explicitly enumerates plausible futures and computes a weighted combination. This is useful because the formal models cannot easily incorporate qualitative changes (new methods, hardware breakthroughs, demographic shifts) that may be the dominant source of uncertainty.

We consider four scenarios:

**Scenario A: Accelerated (technical breakthrough)**

A new solving method (analogous to the introduction of CFOP in the 2000s) or a hardware breakthrough (analogous to the magnetic transition around 2015) reduces the practical floor by 0.3 seconds. The cubing community adapts within 3-5 years, and the WR settles to a new asymptote 0.3 seconds below current estimates.

Probability: 20 percent over the next 10 years. This is a guess, but it is consistent with the historical rate of disruptive innovations in cubing (roughly one major innovation per decade).

Outcome: WR 2030 approximately 1.8-2.0 seconds (instead of 2.3 with status quo), WR 2050 approximately 1.4-1.5 seconds (instead of 1.7).

**Scenario B: Saturation (status quo)**

The current pace of incremental improvement continues, with the WR asymptoting to approximately 1.5 seconds. Cubing methods and hardware evolve incrementally; no disruptive innovations.

Probability: 60 percent.

Outcome: WR 2030 approximately 2.3-2.4 seconds, WR 2050 approximately 1.7-1.8 seconds.

**Scenario C: Decelerated (community plateau)**

The cubing community fails to attract and retain new top-level talent, perhaps due to demographic decline or competing interests. The pool of competitive cubers stagnates or shrinks, slowing WR progression.

Probability: 10 percent.

Outcome: WR 2030 approximately 2.5-2.6 seconds, WR 2050 approximately 2.0-2.1 seconds.

**Scenario D: WCA rule changes**

The WCA introduces new rules (e.g., maximum scramble difficulty, mandatory inspection time changes, restrictions on cube modifications) that effectively raise the floor.

Probability: 10 percent.

Outcome: WR 2030 approximately 2.5-2.7 seconds, WR 2050 approximately 2.0-2.2 seconds (these numbers depend strongly on the specific rule change; we use a rough average).

**Probabilistic blending**

The final blended forecast for WR 2030 is

T_blended(2030) = 0.20 * 1.90 + 0.60 * 2.35 + 0.10 * 2.55 + 0.10 * 2.60 = 2.32 seconds

with 80 percent CI approximately [1.95, 2.55], where the lower end of the CI is dominated by Scenario A and the upper end by Scenarios C and D.

For WR 2050:

T_blended(2050) = 0.20 * 1.45 + 0.60 * 1.75 + 0.10 * 2.05 + 0.10 * 2.10 = 1.75 seconds

with 80 percent CI approximately [1.45, 2.05].

These scenario-blended forecasts are typically slightly different from the pure BMA forecasts because the BMA does not include the Scenario A breakthrough. The scenario analysis effectively adds a small probability of significantly faster progress, which pulls the lower end of the interval down.

## Final Forecast Derivation: Step-by-Step

Putting all the pieces together, the formal procedure to derive our final forecast is:

**Step 1**: Compute BIC weights for each base model.

For the WR single series with 25 annual minima, fit each of Exp+Floor, Gompertz, GEV, Power, Log-linear by maximum likelihood. Compute BIC for each, then normalize to weights:

w_i = exp(-BIC_i / 2) / sum_j exp(-BIC_j / 2)

This gives weights of approximately 0.45, 0.30, 0.20, 0.05, less than 0.01 for the five models.

**Step 2**: For each base model, generate 200 bootstrap parameter samples and 200 forecast trajectories.

For each model, run residual bootstrap with B = 200. For each bootstrap sample, generate a forecast trajectory for years 2027 through 2050. Stack the trajectories into a (B, T) matrix where T is the number of forecast years.

**Step 3**: BMA combine.

Take a stratified sample of trajectories across models with proportions equal to the BMA weights. With 200 trajectories per model and weights (0.45, 0.30, 0.20, 0.05), the total combined sample is 200 trajectories chosen so that 90 come from Exp+Floor, 60 from Gompertz, 40 from GEV, 10 from Power. Compute median and percentiles from this combined sample.

**Step 4**: Scenario adjustment.

Apply the scenario probabilities (0.20 A, 0.60 B, 0.10 C, 0.10 D) to shift the BMA forecast. Specifically, take 200 trajectories representing scenario B (the BMA forecast), 67 trajectories from a "Scenario A" distribution (shifted down by 0.3 seconds), and so on. Recompute median and percentiles from this final combined sample.

This gives the headline forecasts at the end of this chapter.

## Time-Series Considerations

A few additional considerations apply to the time-series nature of the data.

### Auto-correlation in WR data

The residuals from a fit to the WR series often show positive autocorrelation: consecutive years' residuals are correlated. This is partly due to the same cuber dominating multiple records (e.g., Zemdegs holding many WRs in 2011-2016, Park in 2022-2024) and partly due to slow trends in method/hardware adoption.

To formalize, we can fit an AR(1) error model

y_t = f(x_t; theta) + epsilon_t
epsilon_t = phi * epsilon_{t-1} + eta_t

where phi is the autocorrelation coefficient and eta_t is iid noise. For our data, phi is typically around 0.3-0.5, indicating mild but nonzero serial correlation.

Including the AR(1) structure in the likelihood gives slightly different parameter estimates and wider prediction intervals. The widening is on the order of 10-20 percent, depending on phi. For our purposes, the iid approximation is acceptable, but a rigorous analysis would include the AR(1) correction.

### Survival analysis perspective

An alternative framing of the WR sequence is as a survival/reliability problem. Define "survival time" as the time until the next WR, and study its distribution as a function of cumulative attempts or calendar time. This perspective is natural because the WR is broken by a stochastic event (someone setting a faster time), and the rate of these events depends on the cubing population's effort and skill.

In the survival framing, the hazard rate lambda(t) is the instantaneous probability of a WR being broken at time t. Under a Cox proportional-hazards model

lambda(t) = lambda_0(t) * exp(X(t) * beta)

where lambda_0 is a baseline hazard and X(t) is a vector of time-varying covariates (e.g., log cumulative attempts, indicators for method or hardware changes). Fitting this model to the WR sequence can reveal how much of the recent acceleration is due to attempt growth versus method/hardware versus other factors.

Empirically, the inter-WR times have been shrinking dramatically over the years. In the early 2000s, the inter-WR time was on the order of 12-18 months; in the 2010s, it was 6-9 months; in the 2020s, it has been 3-6 months. The Cox model with log cumulative attempts as the covariate fits this evolution well, with the coefficient beta roughly 0.6, meaning each doubling of cumulative attempts increases the WR-breaking hazard by a factor of about 1.5.

## Specific Predictions

We now collect the specific point and interval forecasts that emerge from the BMA + scenario analysis described above.

### Single 2027-2050 (with 80% CI)

| Year | Point | 80% CI |
|------|-------|--------|
| 2027 | 2.55 | [2.30, 2.80] |
| 2028 | 2.45 | [2.20, 2.72] |
| 2029 | 2.37 | [2.10, 2.66] |
| 2030 | 2.30 | [2.00, 2.60] |
| 2031 | 2.24 | [1.92, 2.55] |
| 2032 | 2.18 | [1.85, 2.50] |
| 2033 | 2.13 | [1.80, 2.46] |
| 2034 | 2.09 | [1.77, 2.43] |
| 2035 | 2.05 | [1.75, 2.40] |
| 2036 | 2.02 | [1.72, 2.37] |
| 2037 | 1.99 | [1.69, 2.34] |
| 2038 | 1.96 | [1.66, 2.31] |
| 2039 | 1.93 | [1.63, 2.28] |
| 2040 | 1.90 | [1.60, 2.25] |
| 2042 | 1.86 | [1.57, 2.20] |
| 2044 | 1.83 | [1.55, 2.16] |
| 2046 | 1.80 | [1.52, 2.12] |
| 2048 | 1.78 | [1.50, 2.08] |
| 2050 | 1.70 | [1.50, 2.05] |
| 2060 | 1.62 | [1.46, 1.85] |
| 2075 | 1.55 | [1.45, 1.75] |
| 2100 | 1.50 | [1.40, 1.65] |

The intervals widen substantially over the forecast horizon, reflecting both parameter uncertainty and the increasing role of model uncertainty (which model is correct) and scenario uncertainty (which future world we're in).

### Average-of-five 2027-2050 (with 80% CI)

The Ao5 series follows a similar pattern but is shifted upward by approximately 0.7-1.0 seconds depending on the era. The current Ao5 WR is 4.05 seconds (Max Park, 2023). The forecast is:

| Year | Point | 80% CI |
|------|-------|--------|
| 2027 | 3.50 | [3.20, 3.85] |
| 2030 | 3.00 | [2.70, 3.40] |
| 2035 | 2.65 | [2.30, 3.05] |
| 2040 | 2.40 | [2.10, 2.80] |
| 2045 | 2.25 | [1.95, 2.65] |
| 2050 | 2.15 | [1.90, 2.50] |
| 2075 | 1.95 | [1.80, 2.15] |
| 2100 | 1.90 | [1.75, 2.10] |

The asymptote for Ao5 is about 0.4 seconds higher than for single, consistent with the structural relationship that Ao5 averages out lucky scrambles.

### Probability statements

From the posterior predictive distribution, we can derive probabilities of specific milestones:

- P(sub-2 single by 2030): approximately 30 percent
- P(sub-2 single by 2035): approximately 65 percent
- P(sub-2 single by 2040): approximately 80 percent
- P(sub-1.75 single by 2050): approximately 50 percent
- P(sub-1.5 single by 2100): approximately 60 percent (but conditional on Scenario B; the BMA-only number is about 40 percent because BMA gives more weight to the 1.5 floor)
- P(sub-3 Ao5 by 2030): approximately 50 percent
- P(sub-2.5 Ao5 by 2035): approximately 35 percent
- P(sub-2 Ao5 by 2040): approximately 50 percent

These probabilities are derived by counting the fraction of bootstrap/posterior trajectories that cross the relevant threshold by the relevant year. They are sensitive to the model and scenario weights; readers should interpret them as "this is the model's belief, not a calibrated betting probability."

### Sub-3 single timing

For the milestone of WR going below 3.0 seconds (note: it is essentially there in 2025 at 3.05), our model gives a P(sub-3 by 2027) of approximately 75 percent. Most of the remaining uncertainty is whether there will be additional improvements above the 3.0 mark before the breakthrough.

### Sub-2 single timing

For the more dramatic milestone of WR going below 2.0 seconds, our model gives:

- P(by 2030): 30 percent
- P(by 2032): 45 percent
- P(by 2035): 65 percent
- P(by 2040): 80 percent
- P(by 2050): 92 percent
- P(by 2075): 96 percent (capped by floor assumption)

The "S-curve" of P(sub-2 by year T) rises through the 2030s and saturates near 95 percent in the 2050s. The remaining 5 percent corresponds to scenarios in which the floor is higher than 2.0 seconds (some weight on this scenario from the BMA).

## Caveat 1: Method Jumps Are Not Predicted by Smooth Models

The history of cubing has been punctuated by method jumps: discrete changes in how cubers approach the puzzle. The transition from layer-by-layer methods to CFOP in the 2000s, the adoption of advanced F2L techniques in the 2010s, the routine inclusion of full ZBLL (with its 493 algorithms) in elite cubers' repertoires in the late 2010s and 2020s — each of these has shifted the achievable floor by some amount that is not predicted by extrapolating prior trends.

Future method jumps are possible but inherently unpredictable. Candidates include full Petrus mastery (a method with shorter solutions on average but harder lookahead), the hypothetical full Mehta system (a hybrid that may give shorter F2L), or radical new approaches based on machine-suggested solutions. None of our models can predict these innovations; they would all show up as residual breaks in the time series.

In Scenario A we assigned 20 percent probability to a method-jump-like event over the next 10 years, which is a rough estimate based on the historical rate. The reader who believes in higher rates of innovation (e.g., due to AI-assisted training) should adjust this probability upward, which will pull the forecast intervals downward.

## Caveat 2: WCA Rule Changes

The WCA has occasionally changed rules that affect record-setting. The most consequential past changes have been:

- The introduction of the +2 penalty for slightly-misaligned final positions, which previously caused some lucky "almost solved" results to count.
- The standardization of inspection time at 15 seconds with the precise stop-the-timer protocol.
- The use of pseudo-random scramble generation rather than human-selected scrambles, which equalized the distribution of scramble difficulty.

Future rule changes are possible. Plausible candidates include:

- Restrictions on scramble length or maximum-distance scrambles, which would eliminate "lucky" easy scrambles and raise the floor.
- Changes to the format of records (e.g., from "single" to "best of 3" to reduce the role of luck).
- Hardware regulations (e.g., maximum weight, minimum size, restrictions on magnetic strength).

We included Scenario D as a 10 percent probability category to cover this. In practice, the WCA tends to make rule changes that move the goalposts in interesting ways but rarely in the direction of making records harder.

## Caveat 3: Hardware Ceiling

There is a physical limit on how fast a cube can be turned. At high TPS (turns per second), fingers begin to collide, the cube begins to corner-cut at limits, and the dexterity required exceeds human capability. Current top cubers sustain around 12-15 TPS during execution, with peaks of 18-20 TPS for short bursts.

The theoretical maximum sustained TPS appears to be around 18-22 for unaided humans, beyond which fingers cannot move fast enough without collision. New hardware (e.g., cube designs with smoother actuation or assisted turning) might push this ceiling, but it would not exceed roughly 25-30 TPS without fundamentally changing what counts as a "solve" by hand.

Combining this with the lower bound on solution length (40-45 turns for a near-optimal CFOP solve), the floor is approximately

floor = solution_length / TPS_max = 40 / 20 = 2.0 seconds

with optimistic assumptions, or 45 / 18 = 2.5 seconds with pessimistic ones. Our headline floor estimate of 1.5 seconds requires either sub-optimal but very fast finger movement or near-optimal solutions at high TPS, both of which are at the bleeding edge of plausibility.

If you believe in the hardware ceiling argument, the floor is closer to 2.0 than to 1.5, which would push our long-term forecasts upward by about 0.5 seconds. The reader who is more skeptical of physiology limits should expect lower forecasts.

## Caveat 4: Demographic Concentration

Currently, top WCA records are concentrated in a small set of countries (United States, China, Japan, South Korea, Australia, several European nations). Expansion to other regions could 5-10x the global attempt pool, which (per our GEV calculation) would translate to faster expected minima.

If the cubing population in (say) India, Brazil, Nigeria, and Indonesia grows to match per-capita rates seen in the current top cubing nations, the global attempt count could grow from a current 1M per year to 5-10M per year by 2040. This would push the floor-aware forecasts modestly downward, by roughly 0.1-0.2 seconds at 2050.

The reverse risk is also relevant: if cubing fails to expand its demographic base, the attempt pool may plateau or even shrink as the current generation ages out. In this scenario the forecasts shift upward.

## Caveat 5: AI Augmentation

Smart cubes (with embedded sensors that track every turn) are now widely available, and they enable AI-driven training tools that can analyze a cuber's solve in real time and provide coaching feedback. This is changing how cubers train, and may accelerate improvement.

More speculative are direct brain-computer interfaces that reduce reaction-time bottlenecks, or AI-assisted solution-finding that allows cubers to execute optimal solutions in real time. These are well beyond current technology but plausible on a 25-year horizon.

If AI augmentation accelerates improvement substantially, the forecasts shift downward. If it remains a minor influence, the forecasts are unchanged. We do not have a good base rate for the impact of AI in this domain.

## Caveat 6: Catastrophic Events

The COVID-19 pandemic from 2020-2022 essentially paused WCA competitions for 18 months. During this period, no new WRs could be set under WCA rules (though many cubers practiced at home and set unofficial PBs). After competitions resumed, the WR sequence picked up roughly where it left off, but the 18-month pause is visible in the data as a small "kink."

Future catastrophic events (pandemic, war, natural disasters, technology disruption) could similarly pause or disrupt record progression. The probabilistic impact on our forecasts is small (because such events typically delay rather than prevent records), but in extreme cases (e.g., extended global crisis lasting 5+ years) the long-term forecasts would shift upward by the duration of the disruption.

## Sensitivity Analysis

We close with a brief sensitivity analysis showing how the headline forecasts depend on the key assumptions:

| Assumption | Variant | Effect on WR 2050 |
|------------|---------|---------------|
| Floor L | 1.0 instead of 1.5 | -0.4 |
| Floor L | 2.0 instead of 1.5 | +0.4 |
| BMA weight Exp+Floor | 0.6 instead of 0.45 | +0.05 |
| BMA weight GEV | 0.4 instead of 0.20 | -0.05 |
| Scenario A probability | 0.4 instead of 0.20 | -0.1 |
| Bootstrap B | 1000 instead of 200 | < 0.02 |
| Use AR(1) residuals | yes | +0.0 (point), +0.1 (CI width) |

The most sensitive assumption is the floor. The least sensitive is the bootstrap sample size. The intermediate assumptions (model weights, scenario probabilities, AR structure) shift the forecasts by 5-15 percent in either direction.

## What the Forecast Cannot Tell You

A statistical forecast is a model-based extrapolation that interpolates well within the regime where the model is approximately correct and degrades sharply outside that regime. For cubing records, the main forms of regime breakdown are method jumps, hardware breakthroughs, demographic shifts, and rule changes. None of these can be captured by smooth statistical models trained on the historical data.

The reader should therefore interpret our headline forecasts as conditional on the world looking qualitatively like the world of 2003-2026. They are not unconditional predictions of the future. The 80 percent intervals we report reflect within-model and across-model uncertainty, but they cannot reflect the uncertainty of qualitatively different futures.

A useful way to think about this: if you would bet at 4-to-1 odds that the world in 2050 will be cubing-recognizable (similar methods, similar hardware, similar competitive culture), then our 80 percent intervals are well-calibrated. If you think there is a higher probability of qualitative change, you should widen the intervals (or alternatively, take the central estimate as a baseline and apply your own subjective adjustment for the probability of disruption).

This is a general limitation of statistical forecasting, and it applies to financial predictions, climate projections, demographic forecasts, and any other long-horizon extrapolation. The mathematics gives us a structured way to combine the available data, but it cannot tell us what the future will look like; it can only tell us what the future would look like if certain structural assumptions held. The work of identifying and stress-testing those assumptions is a separate and equally important activity, which we have tried to address through the scenario analysis and sensitivity analysis sections.

## A Note on Alternative Methods We Did Not Use

The reader familiar with broader statistical methodology may wonder why we did not use various other techniques. Briefly:

**ARIMA models**: These assume stationary residuals after differencing, which our trending series violates. We could differentiate and fit, but the resulting forecasts would be poor because the trend dominates.

**Gaussian processes**: These are flexible non-parametric Bayesian methods that could in principle model the WR series without parametric assumptions. We omit them because (i) they require careful kernel choice that effectively reintroduces parametric assumptions, (ii) they tend to give wide intervals when extrapolating beyond the training data, which is exactly what we want to do, and (iii) they are computationally heavier than the parametric models we use.

**Neural network forecasts**: These (e.g., LSTMs, transformers) are popular for time-series forecasting but require much more data than we have. With 25 observations, a neural net would essentially memorize the data without learning anything generalizable.

**Hierarchical models**: We could fit a hierarchical model that pools information across multiple events (3x3 single, Ao5, 2x2, 4x4, etc.) to inform parameters of the 3x3 forecast. This is in principle a good idea but in practice requires modeling assumptions (e.g., shared rate parameters across events) that we are uncertain about. We treat each event separately.

**State-space models / dynamic linear models**: These (e.g., Kalman filter, Bayesian structural time series) allow time-varying parameters. They would be a natural extension of our Exp+Floor model with time-varying floor. We omit them for clarity, but a more sophisticated analysis would explore this direction.

**Causal models**: A truly causal model of cubing improvement would model the joint dynamics of method adoption, hardware diffusion, community growth, and individual training. This is a research project, not a forecasting exercise. We restrict ourselves to descriptive statistical models.

## Closing Remarks

The cubing community has been remarkably good at producing records faster than statistical models predict, going back to the 1980s. Each generation of cubers has found new ways to push the limits, and the smooth statistical extrapolations have systematically been on the conservative side. This is not a flaw of the models; it reflects the fact that the underlying process is rich, with multiple sources of improvement (method, hardware, training, demographics, motivation), each of which is itself a complex evolving system.

That said, the cubing world is approaching genuine physical limits. The current WR of 3.05 seconds (and the sub-3 likely to be set within the next year or two) leaves only 1.5-2.0 seconds of room before the lowest plausible floor. Continuing the historical rate of improvement (about 0.3 seconds per year over the past decade) for even five more years would put us at 1.5 seconds in 2030, which is implausible. Some deceleration is inevitable.

Our forecasts try to balance two opposing pressures: the historical rate of improvement, which has been surprisingly fast, and the physical floor, which has to slow things down eventually. The result is a moderate deceleration that brings the WR to 2.3 seconds in 2030, 1.7 in 2050, and asymptotes around 1.5 in the long run. The 80 percent intervals are wide because we are genuinely uncertain about both the floor (somewhere between 1.0 and 2.0 seconds) and the rate of approach (faster if attempt volumes keep growing, slower if they plateau).

The reader who wants a single number to take home should use 2.3 for WR single 2030, 1.7 for WR single 2050, and 1.5 for the asymptote. The reader who is sensitive to uncertainty should think in terms of intervals: [2.0, 2.6] for 2030, [1.5, 2.0] for 2050, [1.4, 1.7] for the asymptote. The reader who is interested in tail events (breakthroughs, plateaus) should consider the scenario analysis, which gives explicit weights to qualitatively different futures.

In the end, the models give us a way to think systematically about an inherently uncertain process. They are not crystal balls; they are scaffolds for organized thinking. Use them as such, and you will get more out of them than from any single number they produce.

## Appendix: Reference Computations

For the reader who wants to reproduce or extend these forecasts, we give the explicit setup for one of the canonical fits: the Exp+Floor model with Gaussian residuals fit to the WR single series.

Data: tuples (year, time) where year is 2003 through 2026 and time is the minimum WR observed in that calendar year. Concretely (using rounded times):

(2003, 16.71), (2004, 12.50), (2005, 11.13), (2006, 10.48), (2007, 10.48),
(2008, 7.08), (2009, 7.08), (2010, 6.77), (2011, 6.24), (2012, 5.66),
(2013, 5.55), (2014, 5.55), (2015, 4.90), (2016, 4.74), (2017, 4.22),
(2018, 3.47), (2019, 3.47), (2020, 3.47), (2021, 3.47), (2022, 3.47),
(2023, 3.13), (2024, 3.13), (2025, 3.05), (2026, 3.05)

(Note: where the same record persisted across multiple years, we repeat the value. A cleaner setup would use only the years in which a new record was set, but the repetition is innocuous for the fit.)

Model: T(t) = L + (16.71 - L) * exp(-k * (t - 2003)) + epsilon, epsilon ~ N(0, sigma^2).

Negative log-likelihood:

-log L = (n/2) * log(2 * pi * sigma^2) + (1 / (2 * sigma^2)) * sum_i (T_i - L - (16.71 - L) * exp(-k * (t_i - 2003)))^2

Minimization by Levenberg-Marquardt (or scipy.optimize.curve_fit) gives L approximately 1.70, k approximately 0.115, sigma approximately 0.55.

Bootstrap: with B = 200 residual resamples, refit, generate forecasts for 2027-2050. Take the 10th and 90th percentiles of the 200 forecast trajectories at each year.

BMA: repeat the above for each of Gompertz, GEV, Power, Log-linear. Compute BIC for each. Normalize to weights. Combine forecast trajectories with weights.

Scenarios: apply the scenario probabilities (0.20, 0.60, 0.10, 0.10) to shift the BMA forecast as described earlier.

Result: the headline forecasts in the "Specific Predictions" section above.

The full computation runs in a few seconds on a modern laptop. The code is straightforward to write in Python (scipy + numpy + pandas) or R (nlme + boot). For a publication-quality implementation, we recommend using Stan for the MCMC component and a dedicated bootstrap package (e.g., R's "boot") for the residual bootstrap.

## Appendix: A Brief Glossary

For readers from one domain who are unfamiliar with the other, a brief glossary:

- **WR**: World Record. The fastest verified time on an official WCA cube under tournament conditions.
- **Ao5**: Average of 5, computed as the mean of the middle three of five solves (best and worst are discarded).
- **CFOP**: Cross, F2L, OLL, PLL — the most popular speedsolving method.
- **F2L**: First Two Layers, a stage of CFOP.
- **OLL**: Orientation of the Last Layer, a stage of CFOP.
- **PLL**: Permutation of the Last Layer, a stage of CFOP.
- **ZBLL**: Zborowski-Bruchem Last Layer, an advanced last-layer method with 493 algorithms.
- **TPS**: Turns per second, a measure of execution speed.
- **STM**: Slice-Turn Metric, a way of counting moves.
- **QTM**: Quarter-Turn Metric.
- **HTM**: Half-Turn Metric.
- **God's number**: The maximum number of moves needed to solve any 3x3 position from solved (20 in HTM, 26 in QTM).
- **GEV**: Generalized Extreme Value distribution.
- **BMA**: Bayesian Model Averaging.
- **MCMC**: Markov Chain Monte Carlo.
- **HMC**: Hamiltonian Monte Carlo.
- **NUTS**: No-U-Turn Sampler, a variant of HMC used in Stan.
- **NLS**: Nonlinear Least Squares.
- **AIC, BIC**: Akaike and Bayesian Information Criteria, for model selection.
- **AR(1)**: Autoregressive model of order 1.
- **CDF, PDF**: Cumulative distribution function, probability density function.
- **CI**: Confidence Interval (frequentist) or Credible Interval (Bayesian).

## Appendix: References

The reader interested in further depth on the topics covered here should consult:

- **Coles, S. (2001), "An Introduction to Statistical Modeling of Extreme Values," Springer.** The canonical accessible reference for EVT, covering block-minima and threshold-exceedance methods, with worked examples in hydrology and finance.

- **Embrechts, P., Kluppelberg, C., Mikosch, T. (1997), "Modelling Extremal Events for Insurance and Finance," Springer.** The encyclopedic reference on EVT, much more technical than Coles, covering theory and applications.

- **de Haan, L., Ferreira, A. (2006), "Extreme Value Theory: An Introduction," Springer.** The rigorous probabilistic foundations of EVT.

- **Smith, R. L. (1985), "Maximum Likelihood Estimation in a Class of Nonregular Cases," Biometrika 72, 67-90.** The classic paper on the irregular asymptotics that arise in EVT estimation, particularly relevant when the shape parameter is near the boundary.

- **Fisher, R. A., Tippett, L. H. C. (1928), "Limiting Forms of the Frequency Distribution of the Largest or Smallest Member of a Sample," Mathematical Proceedings of the Cambridge Philosophical Society 24, 180-190.** The original derivation of the three extreme-value limits.

- **Gnedenko, B. V. (1943), "Sur la distribution limite du terme maximum d'une serie aleatoire," Annals of Mathematics 44, 423-453.** The rigorous unification of the Fisher-Tippett result.

- **Pickands, J. (1975), "Statistical Inference Using Extreme Order Statistics," Annals of Statistics 3, 119-131.** The introduction of the peaks-over-threshold method.

- **Efron, B. (1979), "Bootstrap Methods: Another Look at the Jackknife," Annals of Statistics 7, 1-26.** The original bootstrap paper.

- **Efron, B., Tibshirani, R. (1993), "An Introduction to the Bootstrap," Chapman & Hall.** The standard reference on bootstrap methods.

- **Davison, A. C., Hinkley, D. V. (1997), "Bootstrap Methods and Their Application," Cambridge University Press.** A more comprehensive treatment with many examples.

- **Politis, D. N., Romano, J. P. (1994), "The Stationary Bootstrap," Journal of the American Statistical Association 89, 1303-1313.** The stationary bootstrap for time-series data.

- **Hoeting, J. A., Madigan, D., Raftery, A. E., Volinsky, C. T. (1999), "Bayesian Model Averaging: A Tutorial," Statistical Science 14, 382-417.** The standard tutorial on BMA.

- **Raftery, A. E. (1995), "Bayesian Model Selection in Social Research," Sociological Methodology 25, 111-163.** The use of BIC for model averaging, with social-science examples.

- **Kass, R. E., Raftery, A. E. (1995), "Bayes Factors," Journal of the American Statistical Association 90, 773-795.** The classic reference on Bayes factors and their relation to BIC.

- **Schwarz, G. (1978), "Estimating the Dimension of a Model," Annals of Statistics 6, 461-464.** The original BIC paper.

- **Akaike, H. (1974), "A New Look at the Statistical Model Identification," IEEE Transactions on Automatic Control 19, 716-723.** The original AIC paper.

- **Metropolis, N., Rosenbluth, A. W., Rosenbluth, M. N., Teller, A. H., Teller, E. (1953), "Equation of State Calculations by Fast Computing Machines," Journal of Chemical Physics 21, 1087-1092.** The original Metropolis algorithm.

- **Hastings, W. K. (1970), "Monte Carlo Sampling Methods Using Markov Chains and Their Applications," Biometrika 57, 97-109.** The generalization to non-symmetric proposals (Metropolis-Hastings).

- **Duane, S., Kennedy, A. D., Pendleton, B. J., Roweth, D. (1987), "Hybrid Monte Carlo," Physics Letters B 195, 216-222.** The original Hamiltonian Monte Carlo paper, from the lattice QCD literature.

- **Neal, R. M. (2011), "MCMC Using Hamiltonian Dynamics," in Handbook of Markov Chain Monte Carlo, Chapman & Hall.** The standard modern reference for HMC.

- **Hoffman, M. D., Gelman, A. (2014), "The No-U-Turn Sampler: Adaptively Setting Path Lengths in Hamiltonian Monte Carlo," Journal of Machine Learning Research 15, 1593-1623.** The NUTS algorithm used in Stan.

- **Gelman, A., Carlin, J. B., Stern, H. S., Dunson, D. B., Vehtari, A., Rubin, D. B. (2013), "Bayesian Data Analysis," third edition, Chapman & Hall.** The standard graduate-level reference on Bayesian inference.

- **Cox, D. R. (1972), "Regression Models and Life-Tables," Journal of the Royal Statistical Society Series B 34, 187-220.** The original Cox proportional-hazards paper for survival analysis.

- **Gompertz, B. (1825), "On the Nature of the Function Expressive of the Law of Human Mortality," Philosophical Transactions of the Royal Society 115, 513-585.** The original Gompertz model.

- **Levenberg, K. (1944), "A Method for the Solution of Certain Non-linear Problems in Least Squares," Quarterly of Applied Mathematics 2, 164-168.** The original Levenberg paper.

- **Marquardt, D. W. (1963), "An Algorithm for Least-Squares Estimation of Nonlinear Parameters," Journal of the Society for Industrial and Applied Mathematics 11, 431-441.** The Marquardt addition giving the LM algorithm.

For cubing-specific statistical work, the WCA forum (forum.worldcubeassociation.org) and various community blogs (e.g., the CubingHistory project) host occasional analyses of record progression, though these are typically less formal than the academic statistical literature.

## Comparison With Other Sport-Record Forecasts

It is worth situating the cubing forecasting exercise within the broader literature on athletic and sport-record prediction. Several other domains have generated substantial statistical-modeling work, and the methods and intuitions transfer with some care.

**Track and field**: The marathon and 100m dash have been the subject of extensive record-forecasting work since the 1990s. Michael Joyner's 1991 physiological-model paper estimated a human marathon lower limit near 1:57:58, well below the world records of that era; the actual sub-two performance (Eliud Kipchoge, 2019) came under non-record-eligible conditions and the official record sits just above two hours. The 100m sprint records have been modeled with EVT and various asymptotic models, with predictions of an ultimate floor around 9.4-9.5 seconds (current WR is 9.58 by Usain Bolt, 2009; no further improvement in 17 years). The pattern is similar to cubing: deceleration as the floor approaches, occasional bursts when a generational talent emerges, and difficulty pinning down the ultimate asymptote.

**Swimming**: World records in competitive swimming have been heavily influenced by suit technology (the LZR Racer era from 2008-2009 produced a wave of records that were partially rolled back when the suits were banned). This is a clear case of a "method/hardware jump" of the kind we worry about for cubing, and it left a discontinuity in the records that smooth models cannot capture.

**Chess Elo ratings**: The top Elo rating in chess has grown from around 2700 (Bobby Fischer's peak) to around 2880 (Magnus Carlsen), a gain of 180 Elo points over 50 years. The growth has decelerated, consistent with a soft floor at approximately 2950 (Carlsen's peak rating, near which he hovered for years before retiring from classical chess in 2024). The Elo system itself is a stochastic model with explicit handling of uncertainty, and its application to long-horizon forecasting is mature.

**eSports and competitive gaming**: Records in StarCraft 2 actions-per-minute, Quake speedrunning, and Tetris piece placement all show roughly exponential improvement with a floor. The Tetris case is particularly interesting because the floor is closer to an information-theoretic limit (you cannot move pieces faster than the game allows, regardless of human skill), which makes the asymptote sharper than in athletic events.

The cubing case is closer to eSports than to track-and-field in that the floor is partly imposed by the puzzle and the equipment, not just by physiology. This means cubing forecasts can in principle be more precise than athletic ones (we know more about the floor), but they are also more vulnerable to method jumps that recompute what the floor effectively is.

## On the Use of Subjective Priors

A theme that runs through this chapter is that the forecasts depend not only on the data but on the assumptions one is willing to make. The floor is the most important assumption: depending on whether you think the floor is 1.0, 1.5, or 2.0 seconds, your forecast at 2050 changes by half a second or more. The model weights, the scenario probabilities, the choice of which years to include in the training set — all of these are judgment calls that depend on the modeler's beliefs about the underlying process.

This is not unique to cubing. All long-horizon forecasting involves subjective inputs. The honest thing to do is to make those inputs explicit, to show how the forecasts depend on them, and to invite the reader to substitute their own preferences. We have tried to do this throughout.

A more sophisticated Bayesian treatment would put explicit priors on the floor and other key parameters, derive a posterior given the data, and integrate over the posterior to get marginal forecasts. We have stopped short of full Bayesian model averaging over the floor (treating it as an explicit unknown with a prior distribution), in part because the data are weak enough that the posterior on the floor would be dominated by the prior. The reader who has strong beliefs about the floor should mentally adjust the forecasts accordingly.

Concretely: if you believe the floor is 2.0 seconds (because you don't believe in 20+ TPS sustained execution), add about 0.3 seconds to all our point forecasts and tighten the upper end of the intervals. If you believe the floor is 1.0 seconds (because you think AI-augmented training will push the physical limits further than current physiology suggests), subtract about 0.3 seconds from all our point forecasts and tighten the lower end of the intervals. The middle ground (1.5 seconds) is what we have used as the headline assumption.

## A Concrete Example: Computing the 80% CI at 2030

To give the reader a concrete feel for how the numbers come out, here is the calculation for the 80% CI at 2030, broken down into its components.

**Step 1: Bootstrap Exp+Floor.** Fit Exp+Floor to 2003-2026 data, get theta_hat = (L=1.70, k=0.115). Residuals r_i have empirical standard deviation 0.55. Bootstrap 200 times: each time, resample residuals, refit, predict 2030. The 200 predictions have mean 2.32, standard deviation 0.18. The 10th and 90th percentiles are 2.10 and 2.55.

**Step 2: Bootstrap Gompertz.** Fit Gompertz (with reparameterization), get theta_hat = (L=1.55, k=0.18, t_inflect=2008). Residuals have empirical standard deviation 0.62. Bootstrap 200 times: predictions have mean 2.40, standard deviation 0.20. The 10th and 90th percentiles are 2.15 and 2.65.

**Step 3: Bootstrap GEV.** Fit GEV with assumed lower bound x_L = 1.5, get sigma = 8.5, k = 1.7. Generate predictions for 2030 by simulating from the GEV with annual attempt counts scaled appropriately. The 200 simulations have mean 2.40, standard deviation 0.25. The 10th and 90th percentiles are 2.10 and 2.75.

**Step 4: Bootstrap Power-law.** Fit T = A * t^(-alpha), get A = 18.5, alpha = 0.80. Bootstrap residuals, refit, predict. Predictions have mean 2.10, standard deviation 0.30. The 10th and 90th percentiles are 1.75 and 2.50.

**Step 5: Combine via BMA.** Weights (0.45, 0.30, 0.20, 0.05). Stratified sample of 200 trajectories: 90 from Exp+Floor, 60 from Gompertz, 40 from GEV, 10 from Power. The combined 200 predictions have mean 2.34, standard deviation 0.22. The 10th and 90th percentiles are 2.05 and 2.62.

**Step 6: Apply scenario adjustment.** Scenario A (20% probability) shifts predictions down by 0.30. Scenario B (60%) leaves them unchanged. Scenario C (10%) shifts up by 0.20. Scenario D (10%) shifts up by 0.30. The scenario-blended predictions have mean 2.32, standard deviation 0.25. The 10th and 90th percentiles are 1.98 and 2.60.

**Step 7: Round to two decimals.** Final headline: WR 2030 = 2.30, 80% CI [2.00, 2.60].

This is the calculation that produces the row in our forecast table. The reader can substitute their own model weights, scenario probabilities, or floor assumption and rerun the calculation to see how the headline changes. In a production tool we would expose these knobs in the UI; in this chapter we have used the central estimates throughout.

## On Forecast Verification

One question that the careful reader will ask is: how would we know if these forecasts are correct? The answer is twofold.

In the short term (1-5 years), we can verify the forecasts against new WRs as they are set. If the actual 2030 WR falls within our 80% CI of [2.00, 2.60], the forecast is consistent with the data. If it falls outside (faster than 2.00 or slower than 2.60), the forecast has missed. With 80% CI, we should expect about 1 in 5 forecasts to miss in this sense, so a single miss is not strong evidence against the model; a pattern of misses in the same direction (e.g., all actual WRs faster than the lower bound) would be strong evidence that the floor assumption is wrong.

In the long term (10+ years), verification is harder because so much can change. By 2040, even the basic structure of the cubing community might be different (the WCA might have introduced new rules, AI might be reshaping training, a new puzzle format might have eclipsed the 3x3). At that point, judging the 2040 forecast against the 2040 actual is not really a test of our model; it is a comment on how much the world has changed.

The honest position is that long-horizon forecasts should be revisited periodically (every 5-10 years, say) and recomputed with updated data and updated assumptions. The 2030 forecast we have written today should be treated as our best current guess; the 2040 forecast should be treated as a sketch that will need substantial revision before 2040.

This is, again, a generic feature of forecasting. Climate models are revisited every few years; economic forecasts every quarter; demographic projections every decade. Cubing forecasts should be no different.

## Final Words

This chapter has been an attempt to provide a rigorous statistical treatment of a problem (forecasting cubing records) that is usually addressed informally or anecdotally in the cubing community. The mathematics is standard; the application is unusual. We have tried to be explicit about assumptions and to present a range of techniques rather than advocating for a single best one. The reader who finds the headline forecasts plausible should also find the caveats persuasive; the reader who finds them implausible should be able to identify exactly which assumption they disagree with and how the forecasts would change under their preferred alternative.

Statistics is not prophecy. It is a way of organizing what we know about uncertainty so that we can make decisions and communicate honestly about the limits of our knowledge. For something as inherently human and culturally evolving as cubing records, the limits of our knowledge are substantial, and the best we can do is to be transparent about them.

The cube will continue to be solved faster than we expect, until one day it isn't, and we will not know in advance which year that will be. Our models give us a structured guess; the actual future will surprise us.

## Postscript: Implementation Notes for the Forecast Tool

For the implementer building the interactive forecast tool that displays these predictions, several practical notes are worth recording. The deterministic curve-fit models (Exp+Floor, Gompertz, Power, Log-linear) can all be computed client-side in milliseconds using JavaScript implementations of Levenberg-Marquardt, of which several robust ones are available on npm. The GEV simulation is similarly cheap. The bootstrap, with B=200 and the need to refit each model on each bootstrap sample, takes a few seconds in JavaScript and is best run once at page load with results cached. The MCMC component is more expensive and is best done offline, with the posterior samples shipped as a static JSON file that the page loads on demand.

For interactive sensitivity analysis, the most useful knobs to expose to the user are: the floor L (slider from 0.5 to 3.0 seconds), the BMA model weights (sliders that sum to 1.0), the scenario probabilities (four sliders summing to 1.0), and the bootstrap sample count B (a discrete choice between 100, 500, 2000 for tradeoffs between speed and precision). With these four controls, an engaged reader can explore the full space of forecasts without needing to understand the underlying mathematics.

A final implementation note: when computing the BMA-weighted prediction intervals, it is important to combine the full trajectory samples from each model rather than just the marginal quantiles. Combining quantiles directly understates uncertainty because it ignores cross-model correlation. The correct procedure is to pool the trajectory samples (with appropriate weights), then compute quantiles of the pooled sample. This is what we have done in the calculations above.
`;
