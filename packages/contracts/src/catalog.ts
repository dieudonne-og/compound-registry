export const COMPOUND_COLUMNS = [
  'sn_percent',
  'moisture_percent',
  'fe2o3_percent',
  'sio2_percent',
  'na2o_percent',
  'mgo_percent',
  'p2o5_percent',
  'so3_percent',
  'cl_percent',
  'k2o_percent',
  'tio2_percent',
  'cr2o3_percent',
  'mno_percent',
  'zno_percent',
  'as2o3_percent',
  'rb2o_percent',
  'zro2_percent',
  'nb2o5_percent',
  'ta2o5_percent',
  'wo3_percent',
  'u3o8_percent',
  'tho2_percent',
  'al2o3_percent',
  'cuo_percent',
  'y2o3_percent',
  'ceo2_percent',
  'hfo2_percent',
  'cao_percent',
  'sno2_percent',
  'bao_percent',
  'sro_percent',
  'pbo_percent',
  'i_percent',
  'hso2_percent',
  'ai2o3_percent',
  'fe_percent',
  'ti_percent',
  'mn_percent',
  'bal_percent',
  'as_percent',
  'bi_percent',
  'ph_percent',
  'wo_percent',
  'ta_percent',
  'sb_percent',
  'cu_percent',
  'zn_percent',
  'ag_percent',
  'co_percent',
  'ni_percent',
] as const;

export type CompoundColumn = (typeof COMPOUND_COLUMNS)[number];
export type CompoundKind = 'element' | 'oxide' | 'other';

export interface CompoundDef {
  column: CompoundColumn;
  label: string;
  kind: CompoundKind;
  aliases: string[];
  /** false = never filled by extraction; reviewers may still enter it manually */
  autoFill: boolean;
}

const oxide = (column: CompoundColumn, label: string, ...extra: string[]): CompoundDef => ({
  column,
  label,
  kind: 'oxide',
  aliases: [label, ...extra],
  autoFill: true,
});
const element = (column: CompoundColumn, label: string, ...extra: string[]): CompoundDef => ({
  column,
  label,
  kind: 'element',
  aliases: [label, ...extra],
  autoFill: true,
});
const manual = (
  column: CompoundColumn,
  label: string,
  kind: CompoundKind,
  aliases: string[] = [],
): CompoundDef => ({
  column,
  label,
  kind,
  aliases,
  autoFill: false,
});

export const COMPOUND_CATALOG: readonly CompoundDef[] = [
  element('sn_percent', 'Sn'),
  {
    column: 'moisture_percent',
    label: 'Moisture',
    kind: 'other',
    autoFill: true,
    aliases: ['Moisture', 'H2O', 'Humidity', 'Humidité', 'Humidite'],
  },
  oxide('fe2o3_percent', 'Fe2O3'),
  oxide('sio2_percent', 'SiO2'),
  oxide('na2o_percent', 'Na2O'),
  oxide('mgo_percent', 'MgO'),
  oxide('p2o5_percent', 'P2O5'),
  oxide('so3_percent', 'SO3'),
  element('cl_percent', 'Cl', 'CI'),
  oxide('k2o_percent', 'K2O'),
  oxide('tio2_percent', 'TiO2'),
  oxide('cr2o3_percent', 'Cr2O3'),
  oxide('mno_percent', 'MnO'),
  oxide('zno_percent', 'ZnO'),
  oxide('as2o3_percent', 'As2O3'),
  oxide('rb2o_percent', 'Rb2O'),
  oxide('zro2_percent', 'ZrO2'),
  oxide('nb2o5_percent', 'Nb2O5'),
  oxide('ta2o5_percent', 'Ta2O5'),
  oxide('wo3_percent', 'WO3'),
  oxide('u3o8_percent', 'U3O8'),
  oxide('tho2_percent', 'ThO2'),
  // OCR often reads the "l" of Al2O3 as a capital I, so AI2O3 resolves here.
  oxide('al2o3_percent', 'Al2O3', 'AI2O3'),
  oxide('cuo_percent', 'CuO'),
  oxide('y2o3_percent', 'Y2O3'),
  oxide('ceo2_percent', 'CeO2'),
  oxide('hfo2_percent', 'HfO2'),
  oxide('cao_percent', 'CaO'),
  oxide('sno2_percent', 'SnO2'),
  oxide('bao_percent', 'BaO'),
  oxide('sro_percent', 'SrO'),
  oxide('pbo_percent', 'PbO'),
  manual('i_percent', 'I', 'element'),
  manual('hso2_percent', 'HSO2', 'other'),
  manual('ai2o3_percent', 'AI2O3 (legacy)', 'other'),
  element('fe_percent', 'Fe'),
  element('ti_percent', 'Ti'),
  element('mn_percent', 'Mn'),
  manual('bal_percent', 'Balance', 'other', ['Bal', 'Balance']),
  element('as_percent', 'As'),
  element('bi_percent', 'Bi'),
  manual('ph_percent', 'PH', 'other'),
  element('wo_percent', 'W'),
  element('ta_percent', 'Ta'),
  element('sb_percent', 'Sb'),
  element('cu_percent', 'Cu'),
  element('zn_percent', 'Zn'),
  element('ag_percent', 'Ag'),
  element('co_percent', 'Co'),
  element('ni_percent', 'Ni'),
];

export const CATALOG_BY_COLUMN: ReadonlyMap<CompoundColumn, CompoundDef> = new Map(
  COMPOUND_CATALOG.map((d) => [d.column, d]),
);

export const ELEMENT_SYMBOLS: ReadonlySet<string> = new Set(
  (
    'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr ' +
    'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm ' +
    'Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu'
  ).split(' '),
);
