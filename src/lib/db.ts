/**
 * In-memory IDPF synthetic data store.
 * Generates realistic transaction data matching the IDPF domain
 * (GSA rules, doc verify, face scan, PDMA, risk eval).
 * Runs entirely in the browser — no external DB required.
 */

export interface Transaction {
  id: string;
  transaction_id: string;
  started_at: string;
  completed_at: string;
  event_date: string;                   // YYYY-MM-DD
  doc_result: string | null;
  face_result: string | null;
  gsa_result: string | null;
  pdma_result: string | null;
  risk_result: string | null;
  final_result: string;
  rules_fired: string[];
  primary_decline_reason: string | null;
  // GSA feature fields
  cmra_flag: boolean;
  pbsa_flag: boolean;
  pobox_flag: boolean;
  fault_code: string | null;
  gen_return_code: string | null;
  comm_error: boolean;
}

// Seeded pseudo-random so data is stable on reload
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(0xDEADBEEF);

function rnd() { return rng(); }

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function isoTs(d: Date, offsetMs = 0): string {
  return new Date(d.getTime() + offsetMs).toISOString();
}

const GEN_RETURN_CODES = ['X', 'A', 'B', 'H', 'M', 'S', 'Z'];

function generateTransactions(count = 1500): Transaction[] {
  const txs: Transaction[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(rnd() * 30);
    const dayDate = new Date(now);
    dayDate.setDate(dayDate.getDate() - daysAgo);
    dayDate.setHours(0, 0, 0, 0);
    const startedAt = isoTs(dayDate, Math.floor(rnd() * 86_400_000));
    const completedAt = isoTs(new Date(startedAt), Math.floor(rnd() * 5000) + 800);

    const txId = `TX${String(i + 1).padStart(6, '0')}`;
    const id   = `${txId}-${Math.floor(rnd() * 0xFFFFFF).toString(16)}`;

    // ── Doc Verify (93% pass) ──────────────────────────────────────
    const docResult = rnd() < 0.07
      ? 'NOT_VALIDATED'
      : 'IDENTITY_DOCUMENT_VALIDATED';

    // ── Face Scan (86% pass when doc passes) ──────────────────────
    let faceResult: string | null = null;
    if (docResult === 'IDENTITY_DOCUMENT_VALIDATED') {
      faceResult = rnd() < 0.14 ? 'NOT_VALIDATED' : 'VALIDATED';
    }

    // ── GSA (only when doc+face pass) ─────────────────────────────
    let cmra = false, pbsa = false, pobox = false;
    let faultCode: string | null = null;
    let genRetCode: string | null = null;
    let commError = false;
    let gsaResult: string | null = null;
    let ruleFired: string | null = null;

    if (docResult === 'IDENTITY_DOCUMENT_VALIDATED' && faceResult === 'VALIDATED') {
      const r = rnd();
      if      (r < 0.13) { cmra = true;  gsaResult = 'ADDRESS_NOT_CIP_COMPLIANT'; ruleFired = 'Rule 7'; }
      else if (r < 0.23) { pbsa = true;  gsaResult = 'ADDRESS_NOT_CIP_COMPLIANT'; ruleFired = 'Rule 8'; }
      else if (r < 0.31) { pobox = true; gsaResult = 'ADDRESS_NOT_CIP_COMPLIANT'; ruleFired = 'Rule 9'; }
      else if (r < 0.36) {
        faultCode  = 'KOEC0039';
        genRetCode = pick(GEN_RETURN_CODES);
        if (genRetCode === 'X') { gsaResult = 'PROCESSING_ERROR'; ruleFired = 'Rule 3'; }
        else                   { gsaResult = 'ADDRESS_NOT_CIP_COMPLIANT'; ruleFired = 'Rule 5'; }
      }
      else if (r < 0.39) { commError = true; gsaResult = 'PROCESSING_ERROR'; ruleFired = 'Rule 6'; }
      else if (r < 0.42) { faultCode = 'KOEC0647'; gsaResult = 'NO_RESULT'; ruleFired = 'Rule 1'; }
      else if (r < 0.44) { faultCode = 'KOEC0692'; gsaResult = 'NO_RESULT'; ruleFired = 'Rule 2'; }
      else               { gsaResult = 'NO_RESULT'; ruleFired = 'Rule 0'; }
    }

    // ── PDMA (called when GSA doesn't hard-stop) ──────────────────
    let pdmaResult: string | null = null;
    const gsaHardStop = cmra || pbsa || pobox || gsaResult === 'PROCESSING_ERROR';
    if (gsaResult && !gsaHardStop) {
      pdmaResult = rnd() < 0.91 ? 'ADDRESS_CIP_COMPLIANT' : 'ADDRESS_NOT_CIP_COMPLIANT';
    }

    // ── Risk Eval ─────────────────────────────────────────────────
    let riskResult: string | null = null;
    const addressOk = gsaResult === 'ADDRESS_CIP_COMPLIANT'
      || gsaResult === 'NO_RESULT'
      || pdmaResult === 'ADDRESS_CIP_COMPLIANT';
    if (gsaResult && addressOk) {
      const r2 = rnd();
      riskResult = r2 < 0.92 ? 'ALLOW' : r2 < 0.97 ? 'INTERDICT' : 'BLOCK';
    }

    // ── Final Result ──────────────────────────────────────────────
    let finalResult: string;
    let declineReason: string | null = null;

    if (docResult !== 'IDENTITY_DOCUMENT_VALIDATED') {
      finalResult = 'IDENTITY_NOT_VERIFIED'; declineReason = 'Document Verification Failed';
    } else if (faceResult !== 'VALIDATED') {
      finalResult = 'IDENTITY_NOT_VERIFIED'; declineReason = 'Face Scan Failed';
    } else if (cmra) {
      finalResult = 'IDENTITY_NOT_VERIFIED'; declineReason = 'CMRA=Y (Rule 7)';
    } else if (pbsa) {
      finalResult = 'IDENTITY_NOT_VERIFIED'; declineReason = 'PBSA=Y (Rule 8)';
    } else if (pobox) {
      finalResult = 'IDENTITY_NOT_VERIFIED'; declineReason = 'POBox=P (Rule 9)';
    } else if (gsaResult === 'PROCESSING_ERROR') {
      finalResult = 'IDENTITY_NOT_VERIFIED';
      declineReason = commError ? 'GSA Comm Error (Rule 6)' : 'KOEC0039+X (Rule 3)';
    } else if (pdmaResult === 'ADDRESS_NOT_CIP_COMPLIANT') {
      finalResult = 'IDENTITY_NOT_VERIFIED'; declineReason = 'PDMA Not CIP Compliant';
    } else if (riskResult === 'BLOCK' || riskResult === 'INTERDICT') {
      finalResult = 'IDENTITY_NOT_VERIFIED'; declineReason = `Risk: ${riskResult}`;
    } else if (riskResult === 'ALLOW') {
      finalResult = 'IDENTITY_VERIFIED';
    } else {
      finalResult = 'IDENTITY_NOT_VERIFIED'; declineReason = 'Pipeline Incomplete';
    }

    txs.push({
      id, transaction_id: txId,
      started_at: startedAt,
      completed_at: completedAt,
      event_date: isoDate(dayDate),
      doc_result:  docResult,
      face_result: faceResult,
      gsa_result:  gsaResult,
      pdma_result: pdmaResult,
      risk_result: riskResult,
      final_result: finalResult,
      rules_fired: ruleFired ? [ruleFired] : [],
      primary_decline_reason: declineReason,
      cmra_flag: cmra, pbsa_flag: pbsa, pobox_flag: pobox,
      fault_code: faultCode, gen_return_code: genRetCode,
      comm_error: commError,
    });
  }

  return txs;
}

// Singleton — generated once, stable for the session
class InMemoryDB {
  private _txs: Transaction[] | null = null;

  get transactions(): Transaction[] {
    if (!this._txs) this._txs = generateTransactions(1500);
    return this._txs;
  }
}

export const db = new InMemoryDB();
