/**
 * AVATAR Localized Formatters & DB Translation Helpers
 * 
 * Veritabanından Türkçe (veya farklı biçimlerde) gelen birimler, durumlar (status),
 * ürün adları, hayvan türleri ve kesim parçalarını aktif dile (TR/EN/DE) çevirir.
 */

export function formatUnit(unit?: string | null, t?: (key: string) => string): string {
  if (!unit) return '';
  const u = unit.toString().trim().toLowerCase();

  const trMap: Record<string, string> = {
    paket: 'paket',
    package: 'paket',
    pack: 'paket',
    pkt: 'paket',
    kg: 'kg',
    kilogram: 'kg',
    adet: 'adet',
    tane: 'adet',
    pcs: 'adet',
    piece: 'adet',
    stk: 'adet',
    lt: 'lt',
    l: 'lt',
    litre: 'lt',
    liter: 'lt',
    g: 'g',
    gr: 'g',
    gram: 'g',
  };

  if (!t) return trMap[u] || unit;

  if (u === 'paket' || u === 'package' || u === 'pack' || u === 'pkt') {
    return t('units.package') || 'paket';
  }
  if (u === 'kg' || u === 'kilogram') {
    return t('units.kg') || 'kg';
  }
  if (u === 'adet' || u === 'tane' || u === 'pcs' || u === 'piece' || u === 'stk') {
    return t('units.piece') || 'adet';
  }
  if (u === 'lt' || u === 'l' || u === 'litre' || u === 'liter') {
    return t('units.liter') || 'lt';
  }
  if (u === 'g' || u === 'gr' || u === 'gram') {
    return t('units.gram') || 'g';
  }

  return unit;
}

export function formatDbStatus(status?: string | null, t?: (key: string) => string): string {
  if (!status) return '';
  const s = status.toString().trim().toLowerCase();

  if (!t) return status;

  // Invoice / Payment
  if (s === 'odendi' || s === 'paid') return t('invoices.paid') || 'PAID';
  if (s === 'odenmedi' || s === 'unpaid') return t('invoices.unpaid') || 'UNPAID';

  // Orders
  if (s === 'beklemede' || s === 'pending') return t('orderStatus.pending') || 'Beklemede';
  if (s === 'onaylandi' || s === 'approved') return t('orderStatus.approved') || 'Onaylandı';
  if (s === 'hammadde_gonderildi' || s === 'materials_sent') return t('orderStatus.materialsSent') || 'Hammadde Gönderildi';
  if (s === 'uretimde' || s === 'in_production') return t('orderStatus.in_production') || 'Üretimde';
  if (s === 'tamamlandi' || s === 'completed') return t('orderStatus.completed') || 'Tamamlandı';
  if (s === 'teslim_edildi' || s === 'delivered') return t('orderStatus.delivered') || 'Teslim Edildi';
  if (s === 'iptal' || s === 'cancelled') return t('orderStatus.cancelled') || 'İptal';

  // Lots
  if (s === 'aktif' || s === 'active') return t('lotStatus.active') || 'Aktif';
  if (s === 'pasif' || s === 'passive' || s === 'inactive') return t('common.passive') || 'Pasif';
  if (s === 'ham' || s === 'raw') return t('lotStatus.raw') || 'Ham';
  if (s === 'isleniyor' || s === 'processing') return t('lotStatus.processing') || 'İşleniyor';
  if (s === 'satista' || s === 'on_sale') return t('lotStatus.onSale') || 'Satışta';
  if (s === 'tukendi' || s === 'depleted') return t('lotStatus.consumed') || 'Tükendi';
  if (s === 'bloke' || s === 'blocked') return t('lotStatus.blocked') || 'Bloke';
  if (s === 'geri_cagirildi' || s === 'recalled') return t('lotStatus.recalled') || 'Geri Çağrıldı';

  return status;
}

export function formatDbProduct(name?: string | null, t?: (key: string) => string): string {
  if (!name) return '';
  const n = name.toString().trim();
  const lower = n.toLowerCase();

  if (!t) return name;

  if (lower.includes('kangal sucuk') || lower === 'sucuk') {
    return t('products.sucuk') || name;
  }
  if (lower === 'salam') {
    return t('products.salam') || name;
  }
  if (lower === 'sosis') {
    return t('products.sosis') || name;
  }
  if (lower === 'pastırma' || lower === 'pastirma') {
    return t('products.pastirma') || name;
  }
  if (lower === 'kavurma') {
    return t('products.kavurma') || name;
  }

  // Check if it's a meat cut
  return formatDbPart(name, t);
}

export function formatDbAnimal(animal?: string | null, t?: (key: string) => string): string {
  if (!animal) return '';
  const a = animal.toString().trim().toLowerCase();
  if (!t) return animal;

  if (a === 'inek' || a === 'dana' || a === 'beef' || a === 'cattle') return t('animals.inek') || 'İnek / Dana';
  if (a === 'koyun' || a === 'kuzu' || a === 'lamb' || a === 'sheep') return t('animals.koyun') || 'Koyun / Kuzu';
  if (a === 'tavuk' || a === 'chicken') return t('animals.tavuk') || 'Tavuk';
  if (a === 'hindi' || a === 'turkey') return t('animals.hindi') || 'Hindi';

  return animal;
}

export function formatDbPart(part?: string | null, t?: (key: string) => string): string {
  if (!part) return '';
  const p = part.toString().trim().toLowerCase();
  if (!t) return part;

  const keyMap: Record<string, string> = {
    'pirzola': 'pirzola',
    'kuzu pirzola': 'pirzola',
    'but': 'but',
    'dana but': 'but',
    'kuzu but': 'but',
    'sırt / kontrfile': 'sırt / kontrfile',
    'sirt / kontrfile': 'sırt / kontrfile',
    'sırt': 'sırt',
    'sirt': 'sırt',
    'kol / omuz': 'kol / omuz',
    'kol': 'kol',
    'dana kol': 'kol',
    'kaburga': 'kaburga',
    'dana kaburga': 'kaburga',
    'gerdan': 'gerdan',
    'dana gerdan': 'gerdan',
    'kıyma / kuşbaşı': 'kıyma / kuşbaşı',
    'kiyma / kusbasi': 'kıyma / kuşbaşı',
    'kıyma': 'kıyma',
    'kiyma': 'kıyma',
    'kuşbaşı': 'kuşbaşı',
    'kusbasi': 'kuşbaşı',
    'incik': 'incik',
    'bağırsak': 'bağırsak',
    'bagirsak': 'bağırsak',
    'antrikot': 'antrikot',
    'bonfile': 'bonfile',
    'kontrfile': 'kontrfile',
    'kontrifile': 'kontrfile',
    'sokum': 'sokum',
    'bütün tavuk': 'bütün tavuk',
    'butun tavuk': 'bütün tavuk',
    'tavuk': 'tavuk',
    'döş': 'döş',
    'dos': 'döş',
    'nuat': 'nuat',
    'tranç': 'tranç',
    'tranc': 'tranç',
    'kemik': 'kemik',
    'sakatat': 'sakatat',
    'yağ': 'yağ',
    'yag': 'yağ',
  };

  const mappedKey = keyMap[p];
  if (mappedKey) {
    const translated = t('parts.' + mappedKey);
    if (translated && translated !== 'parts.' + mappedKey) return translated;
  }

  return part;
}

export function formatDbRole(role?: string | null, t?: (key: string) => string): string {
  if (!role) return '';
  const r = role.toString().trim().toLowerCase();
  if (!t) return role;

  if (r === 'hayvanci') return t('roles.hayvanci') || 'İşletme';
  if (r === 'sucukcu') return t('roles.sucukcu') || 'Üretici';
  if (r === 'market') return t('roles.market') || 'Market';

  return role;
}
