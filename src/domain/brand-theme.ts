export interface BrandTheme {
  primary:string;
  accent:string;
  background:string;
  surface:string;
}
export const DEFAULT_BRAND_THEME:BrandTheme={primary:"#68477B",accent:"#9675A8",background:"#F7F4F8",surface:"#FFFFFF"};
export const BRAND_PRESETS:{name:string;theme:BrandTheme}[]=[
 {name:"Elegant Purple",theme:{primary:"#68477B",accent:"#9675A8",background:"#F7F4F8",surface:"#FFFFFF"}},
 {name:"Rose Gold",theme:{primary:"#A66F70",accent:"#D8A9A0",background:"#FBF3EF",surface:"#FFFFFF"}},
 {name:"Sage Green",theme:{primary:"#647B68",accent:"#A5B69B",background:"#F3F6EF",surface:"#FFFFFF"}},
 {name:"Ocean Blue",theme:{primary:"#365C7A",accent:"#83A9C1",background:"#F1F6FA",surface:"#FFFFFF"}},
 {name:"Luxury Black",theme:{primary:"#292329",accent:"#8E7B69",background:"#F6F2ED",surface:"#FFFFFF"}},
 {name:"Terracotta",theme:{primary:"#A85E48",accent:"#D69B7D",background:"#FAF1EA",surface:"#FFFFFF"}}
];
export function normalizeBrandTheme(value?:Partial<BrandTheme>|null):BrandTheme{
 const valid=(color:unknown,fallback:string)=>typeof color==="string"&&/^#[0-9a-f]{6}$/i.test(color)?color:fallback;
 return {primary:valid(value?.primary,DEFAULT_BRAND_THEME.primary),accent:valid(value?.accent,DEFAULT_BRAND_THEME.accent),background:valid(value?.background,DEFAULT_BRAND_THEME.background),surface:valid(value?.surface,DEFAULT_BRAND_THEME.surface)};
}
export function brandThemeStyle(value?:Partial<BrandTheme>|null):React.CSSProperties{
 const theme=normalizeBrandTheme(value);
 return {"--brand-primary":theme.primary,"--brand-accent":theme.accent,"--brand-background":theme.background,"--brand-surface":theme.surface} as React.CSSProperties;
}
