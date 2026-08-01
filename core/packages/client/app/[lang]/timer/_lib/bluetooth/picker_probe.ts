/**
 * Bisect a device chooser that refuses to open.
 *
 * Written after three rounds of change-one-thing-and-ask-the-user on a report
 * of `requestDevice()` rejecting with a bare `2` on iOS Bluefy — no chooser, no
 * device list, no message. Each round cost a deploy and a reply, and each one
 * tested a single guess. This tests all of them at once.
 *
 * The ladder adds exactly one thing per rung, so the first rung that fails
 * names the culprit:
 *
 *   1. acceptAllDevices alone        — the smallest legal call there is
 *   2. + optionalServices            — the UUIDs we want to read afterwards
 *   3. + optionalManufacturerData    — the company IDs used for MAC recovery
 *   4. filters instead of acceptAll  — what a normal connect actually sends
 *
 * If rung 1 already fails, nothing about our options matters and the problem is
 * the call itself or the environment. If every rung passes, the chooser opens
 * fine and the fault is downstream.
 *
 * **A dismissed chooser counts as success.** That is the whole trick: a browser
 * that opens the picker and gets cancelled rejects with NotFoundError, while
 * one that refuses to open rejects with something else. So the user can tap
 * Cancel on every rung and we still learn everything — they never have to pick
 * a device, and nothing connects.
 *
 * Web Bluetooth normally spends the user activation on the first call, so rungs
 * 2-4 may fail with a gesture complaint on a strict browser. That is fine and
 * self-describing: the raw value is reported verbatim, and a gesture error
 * reads nothing like a native error code. (Bluefy is known not to enforce it —
 * cstimer calls requestDevice after an await and works there.)
 */
import { describeError, isNoDeviceSelected } from './connect_error';
import { pickerOptions } from './index';

export type ProbeOutcome =
  /** The chooser opened. Either a device was offered and dismissed, or picked. */
  | 'opened'
  /** The chooser never opened — this is the rung that names the culprit. */
  | 'refused';

export interface ProbeStep {
  /** What this rung adds over the previous one. */
  adds: { en: string; zh: string };
  outcome: ProbeOutcome;
  /** Exactly what the browser threw, or the chosen device's name. */
  detail: string;
}

/** Build the ladder from the same pieces a real connect uses, so it stays honest. */
function rungs(): { adds: { en: string; zh: string }; opts: RequestDeviceOptions }[] {
  const full = pickerOptions(true) as {
    optionalServices: string[];
    optionalManufacturerData: number[];
  };
  return [
    {
      adds: { en: 'bare acceptAllDevices', zh: '最小调用' },
      opts: { acceptAllDevices: true },
    },
    {
      adds: { en: '+ optionalServices', zh: '+ 服务 UUID 列表' },
      opts: { acceptAllDevices: true, optionalServices: full.optionalServices },
    },
    {
      adds: { en: '+ optionalManufacturerData', zh: '+ 厂商数据编号' },
      opts: {
        acceptAllDevices: true,
        optionalServices: full.optionalServices,
        optionalManufacturerData: full.optionalManufacturerData,
      },
    },
    {
      adds: { en: 'filters instead of acceptAll', zh: '换成过滤条件' },
      opts: pickerOptions(false),
    },
  ];
}

/**
 * Run the ladder, stopping at the first rung that refuses — everything past it
 * is a superset and would refuse too, so continuing would only cost the user
 * more taps for no information.
 */
export async function probePicker(): Promise<ProbeStep[]> {
  if (typeof navigator === 'undefined' || !navigator.bluetooth) return [];
  const out: ProbeStep[] = [];
  for (const rung of rungs()) {
    try {
      const device = await navigator.bluetooth.requestDevice(rung.opts);
      out.push({ adds: rung.adds, outcome: 'opened', detail: device.name ?? '(unnamed device)' });
    } catch (err) {
      if (isNoDeviceSelected(err)) {
        // Cancelled. The chooser opened, which is what we are measuring.
        out.push({ adds: rung.adds, outcome: 'opened', detail: 'dismissed' });
      } else {
        out.push({ adds: rung.adds, outcome: 'refused', detail: describeError(err) });
        break;
      }
    }
  }
  return out;
}
