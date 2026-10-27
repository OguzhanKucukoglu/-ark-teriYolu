/**
 * Lot numarası üretici
 * Format: {PREFIX}-{YIL}-{SIRANO}
 * Örnekler: ET-2026-001, SUC-2026-045, HAY-2026-012
 */

const prefixMap: Record<string, string> = {
  hammadde_et:       'ET',
  hammadde_baharat:  'BAH',
  hammadde_bagırsak: 'BAG',
  hammadde:          'HAM',
  mamul:             'MAM',
  sucuk:             'SUC',
  hayvan:            'HAY',
  parca:             'PRC',
};

export function generateLotNumber(type: string, sequence: number): string {
  const prefix = prefixMap[type.toLowerCase()] || 'LOT';
  const year   = new Date().getFullYear();
  const seq    = String(sequence).padStart(3, '0');
  return `${prefix}-${year}-${seq}`;
}

export function parseLotNumber(lotNumber: string): { prefix: string; year: number; sequence: number } | null {
  const match = lotNumber.match(/^([A-Z]+)-(\d{4})-(\d+)$/);
  if (!match) return null;
  return {
    prefix:   match[1],
    year:     parseInt(match[2]),
    sequence: parseInt(match[3]),
  };
}
