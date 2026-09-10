import { describe, expect, it, vi } from 'vitest';
vi.mock('../src/payment/wechat.js',()=>({}));
vi.mock('../src/payment/airwallex.js',()=>({}));
vi.mock('../src/payment/alipay.js',()=>({}));
import { verifyRefundResponse, type RefundProviderInput } from '../src/platform/refund_provider.js';
const input:RefundProviderInput={provider:'wechat',merchantAccount:'m',transactionId:'tx',requestId:'stable',amountMinor:1001,totalMinor:1001,currency:'CNY',reason:'schedule'};
const response={refund_id:'r1',status:'PROCESSING',out_refund_no:'stable',transaction_id:'tx',amount:{refund:1001,total:1001,currency:'CNY'}};
describe('refund provider identity and amount verification',()=>{
  it('does not treat accepted or processing as successful settlement',()=>{
    expect(verifyRefundResponse(input,response).status).toBe('pending');
    expect(verifyRefundResponse({...input,provider:'airwallex'},{id:'r1',status:'ACCEPTED',request_id:'stable',payment_intent_id:'tx',amount:10.01,currency:'CNY'}).status).toBe('pending');
  });
  it('accepts explicit verified success in all supported providers',()=>{
    expect(verifyRefundResponse(input,{...response,status:'SUCCESS'}).status).toBe('succeeded');
    expect(verifyRefundResponse({...input,provider:'alipay'},{trade_no:'tx',out_request_no:'stable',refund_status:'REFUND_SUCCESS',refund_amount:'10.01'}).status).toBe('succeeded');
    expect(verifyRefundResponse({...input,provider:'airwallex'},{id:'r1',status:'SUCCEEDED',request_id:'stable',payment_intent_id:'tx',amount:10.01,currency:'CNY'}).status).toBe('succeeded');
  });
  it.each([
    {...response,out_refund_no:'another'}, {...response,transaction_id:'another'},
    {...response,amount:{refund:1002,total:1001,currency:'CNY'}},
    {...response,amount:{refund:1001,total:1001,currency:'USD'}},
    {...response,amount:{refund:1001,total:2000,currency:'CNY'}},
    {...response,status:'UNRECOGNIZED'},
    {...response,status:'SUCCESS',amount:{total:1001,currency:'CNY'}},
    {...response,status:'SUCCESS',amount:{refund:'NaN',total:1001,currency:'CNY'}},
    {...response,status:'SUCCESS',amount:{refund:Infinity,total:1001,currency:'CNY'}},
  ])('rejects mismatched or unknown response %#',raw=>expect(()=>verifyRefundResponse(input,raw)).toThrow());
});
