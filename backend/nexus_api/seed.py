"""
Seed data generator for NEXUS-IDP.
Generates 1500 synthetic IDPF transactions using a deterministic PRNG
(Python port of the JS mulberry32 used in src/lib/db.ts).
Rates match: CMRA ~13%, PBSA ~10%, POBox ~8%, KOEC0039 ~5%, comm_err ~3%
"""
import ctypes
import datetime
import random
from typing import Dict, List, Any


def mulberry32(seed: int):
    """Port of JS mulberry32 PRNG — produces identical sequence to the frontend."""
    state = ctypes.c_uint32(seed)

    def next_val() -> float:
        nonlocal state
        state = ctypes.c_uint32(state.value + 0x6D2B79F5)
        # t = Math.imul(seed ^ seed >>> 15, 1 | seed)
        xv = ctypes.c_int32(state.value ^ (state.value >> 15)).value
        iv = ctypes.c_int32(1 | state.value).value
        t = ctypes.c_int32(ctypes.c_int64(xv * iv).value & 0xFFFFFFFF).value
        # t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
        xv2 = ctypes.c_int32(t ^ (ctypes.c_uint32(t).value >> 7)).value
        iv2 = ctypes.c_int32(61 | t).value
        t2 = ctypes.c_int32(ctypes.c_int64(xv2 * iv2).value & 0xFFFFFFFF).value
        t = ctypes.c_uint32(t + t2 ^ t).value
        return ctypes.c_uint32(t ^ (t >> 14)).value / 4294967296

    return next_val


def generate_transactions(n: int = 1500) -> List[Dict[str, Any]]:
    rng = mulberry32(0xDEADBEEF)

    base_date = datetime.date(2025, 11, 1)
    fault_codes = ['KOEC0039', 'KOEC0647', 'KOEC0692']
    fault_sub = ['A', 'B', 'H', 'M', 'S', 'Z', 'X']

    transactions = []
    for i in range(n):
        days_offset = int(rng() * 60)
        event_date = (base_date + datetime.timedelta(days=days_offset)).isoformat()

        doc_pass = rng() < 0.93
        face_pass = rng() < 0.86 if doc_pass else rng() < 0.40
        cmra_flag = rng() < 0.13
        pbsa_flag = rng() < 0.10 if not cmra_flag else False
        pobox_flag = rng() < 0.08 if not cmra_flag and not pbsa_flag else False
        comm_error = rng() < 0.03
        fault_code = None
        fault_sub_code = None
        if not cmra_flag and not pbsa_flag and not pobox_flag and not comm_error:
            if rng() < 0.07:
                fault_code = fault_codes[int(rng() * len(fault_codes))]
                if fault_code == 'KOEC0039':
                    fault_sub_code = fault_sub[int(rng() * len(fault_sub))]

        # Determine rules_fired
        rules_fired = []
        gsa_stop = False
        if cmra_flag:
            rules_fired.append('Rule 7')
            gsa_stop = True
        elif pbsa_flag:
            rules_fired.append('Rule 8')
            gsa_stop = True
        elif pobox_flag:
            rules_fired.append('Rule 9')
            gsa_stop = True
        elif comm_error:
            rules_fired.append('Rule 6')
            gsa_stop = True
        elif fault_code == 'KOEC0039' and fault_sub_code == 'X':
            rules_fired.append('Rule 3')
            gsa_stop = True
        elif fault_code == 'KOEC0039':
            rules_fired.append('Rule 5')
        elif fault_code == 'KOEC0647':
            rules_fired.append('Rule 1')
        elif fault_code == 'KOEC0692':
            rules_fired.append('Rule 2')
        else:
            rules_fired.append('Rule 0')

        # GSA result
        if not gsa_stop and not fault_code:
            gsa_result = 'ADDRESS_CIP_COMPLIANT'
        elif gsa_stop:
            gsa_result = 'ADDRESS_NOT_CIP_COMPLIANT'
        else:
            gsa_result = 'ADDRESS_CIP_COMPLIANT'

        # PDMA
        pdma_result = None
        if not gsa_stop and doc_pass:
            pdma_result = 'ADDRESS_CIP_COMPLIANT' if rng() < 0.91 else 'ADDRESS_NOT_CIP_COMPLIANT'

        # Risk
        risk_result = None
        if pdma_result == 'ADDRESS_CIP_COMPLIANT':
            risk_result = 'ALLOW' if rng() < 0.92 else 'BLOCK'

        # Final
        if not doc_pass:
            final_result = 'IDENTITY_NOT_VERIFIED'
        elif gsa_stop:
            final_result = 'IDENTITY_NOT_VERIFIED'
        elif pdma_result == 'ADDRESS_NOT_CIP_COMPLIANT':
            final_result = 'IDENTITY_NOT_VERIFIED'
        elif risk_result == 'BLOCK':
            final_result = 'IDENTITY_NOT_VERIFIED'
        elif pdma_result == 'ADDRESS_CIP_COMPLIANT' and risk_result == 'ALLOW':
            final_result = 'IDENTITY_VERIFIED'
        else:
            final_result = 'IDENTITY_NOT_VERIFIED'

        transactions.append({
            'id': f'TX{i:05d}',
            'event_date': event_date,
            'doc_result': 'IDENTITY_DOCUMENT_VALIDATED' if doc_pass else 'IDENTITY_DOCUMENT_NOT_VALIDATED',
            'face_result': 'VALIDATED' if face_pass else 'NOT_VALIDATED',
            'cmra_flag': cmra_flag,
            'pbsa_flag': pbsa_flag,
            'pobox_flag': pobox_flag,
            'comm_error': comm_error,
            'fault_code': fault_code,
            'fault_sub_code': fault_sub_code,
            'gsa_result': gsa_result,
            'pdma_result': pdma_result,
            'risk_result': risk_result,
            'final_result': final_result,
            'rules_fired': ','.join(rules_fired),
        })

    return transactions


if __name__ == '__main__':
    txs = generate_transactions()
    verified = sum(1 for t in txs if t['final_result'] == 'IDENTITY_VERIFIED')
    print(f"Generated {len(txs)} transactions, {verified} verified ({verified/len(txs)*100:.1f}%)")
