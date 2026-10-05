import { GemColor } from '../core/types';

export interface ColorMeta {
  color: GemColor;
  emoteName: string;
  emoteIcon: string;
  jewelName: string;
  jewelIcon: string;
  colorHex: string;
}

export interface EmoteSet {
  id: string;
  name: string;
  description: string;
  colors: [ColorMeta, ColorMeta, ColorMeta, ColorMeta, ColorMeta];
}

export const EMOTE_SETS: Record<string, EmoteSet> = {
  elenco_original: {
    id: 'elenco_original',
    name: 'Elenco Original',
    description: 'Praderas del Valle - Elenco principal con Nadezhi, Moogles y Elfa',
    colors: [
      { color: 0, emoteName: 'Nadezhi Payasito', emoteIcon: '/emotes/1103355444124209192.webp', jewelName: 'Rubí', jewelIcon: '🔴', colorHex: '#ef4444' },
      { color: 1, emoteName: 'Nadezhi Asustada', emoteIcon: '/emotes/1103355458179309619.webp', jewelName: 'Zafiro', jewelIcon: '🔷', colorHex: '#3b82f6' },
      { color: 2, emoteName: 'Moogle Invernal', emoteIcon: '/emotes/1536895948179898388.webp', jewelName: 'Esmeralda', jewelIcon: '🟢', colorHex: '#10b981' },
      { color: 3, emoteName: 'Moogle GG', emoteIcon: '/emotes/1536895951950577814.webp', jewelName: 'Topacio', jewelIcon: '🟡', colorHex: '#f59e0b' },
      { color: 4, emoteName: 'Elfa Labure', emoteIcon: '/emotes/1536895958728835182.webp', jewelName: 'Amatista', jewelIcon: '🟣', colorHex: '#a855f7' },
    ],
  },
  show_palomitas: {
    id: 'show_palomitas',
    name: 'Show y Palomitas',
    description: 'Colinas del Atardecer - Fiesta, snacks y diversión en la aldea',
    colors: [
      { color: 0, emoteName: 'Moogle Palomitas', emoteIcon: '/emotes/1536895956312653894.webp', jewelName: 'Rubí', jewelIcon: '🔴', colorHex: '#ef4444' },
      { color: 1, emoteName: 'Moogle Ojos Saltones', emoteIcon: '/emotes/1183152273665302528.webp', jewelName: 'Zafiro', jewelIcon: '🔷', colorHex: '#3b82f6' },
      { color: 2, emoteName: 'Moogle Tostada', emoteIcon: '/emotes/1115081802701357156.webp', jewelName: 'Esmeralda', jewelIcon: '🟢', colorHex: '#10b981' },
      { color: 3, emoteName: 'Moogle Espía', emoteIcon: '/emotes/1536895957143130132.webp', jewelName: 'Topacio', jewelIcon: '🟡', colorHex: '#f59e0b' },
      { color: 4, emoteName: 'Moogle Fan Idol', emoteIcon: '/emotes/1536895949144592514.webp', jewelName: 'Amatista', jewelIcon: '🟣', colorHex: '#a855f7' },
    ],
  },
  ciudadela_arcana: {
    id: 'ciudadela_arcana',
    name: 'La Ciudadela Arcana',
    description: 'Caverna de Cristales y Monte Vesubio - Juicio, respuestas y determinación',
    colors: [
      { color: 0, emoteName: 'Nadezhi Furia', emoteIcon: '/emotes/1149873070371254272.webp', jewelName: 'Rubí', jewelIcon: '🔴', colorHex: '#ef4444' },
      { color: 1, emoteName: 'Moogle Berrinche', emoteIcon: '/emotes/1290811068268154910.webp', jewelName: 'Zafiro', jewelIcon: '🔷', colorHex: '#3b82f6' },
      { color: 2, emoteName: 'Moogle NO', emoteIcon: '/emotes/1115076404074262648.webp', jewelName: 'Esmeralda', jewelIcon: '🟢', colorHex: '#10b981' },
      { color: 3, emoteName: 'Moogle RAID', emoteIcon: '/emotes/1536895953632632842.webp', jewelName: 'Topacio', jewelIcon: '🟡', colorHex: '#f59e0b' },
      { color: 4, emoteName: 'Moogle YES', emoteIcon: '/emotes/1536895958007283712.webp', jewelName: 'Amatista', jewelIcon: '🟣', colorHex: '#a855f7' },
    ],
  },
  noche_magica: {
    id: 'noche_magica',
    name: 'Noche de las Luciérnagas',
    description: 'Bosque Sagrado y Pixie Hollow - Estrellas, magia y ternura',
    colors: [
      { color: 0, emoteName: 'Moogle Amor', emoteIcon: '/emotes/1142187365251686491.webp', jewelName: 'Rubí', jewelIcon: '🔴', colorHex: '#ef4444' },
      { color: 1, emoteName: 'Moogle Alivio', emoteIcon: '/emotes/1258498543916683327.webp', jewelName: 'Zafiro', jewelIcon: '🔷', colorHex: '#3b82f6' },
      { color: 2, emoteName: 'Moogle Risita', emoteIcon: '/emotes/1536895949941637201.webp', jewelName: 'Esmeralda', jewelIcon: '🟢', colorHex: '#10b981' },
      { color: 3, emoteName: 'Moogle Estrellas', emoteIcon: '/emotes/1149873071902171167.webp', jewelName: 'Topacio', jewelIcon: '🟡', colorHex: '#f59e0b' },
      { color: 4, emoteName: 'Moogle Ojos Violetas', emoteIcon: '/emotes/1183152278698479656.webp', jewelName: 'Amatista', jewelIcon: '🟣', colorHex: '#a855f7' },
    ],
  },
  forja_volcan: {
    id: 'forja_volcan',
    name: 'La Forja y el Volcán',
    description: 'Monte del Destino y Erebor - Tensión ardiente, estrés y combate épico',
    colors: [
      { color: 0, emoteName: 'Moogle Furioso', emoteIcon: '/emotes/1536895945659256975.webp', jewelName: 'Rubí', jewelIcon: '🔴', colorHex: '#ef4444' },
      { color: 1, emoteName: 'Moogle Pánico', emoteIcon: '/emotes/1115115603628392578.webp', jewelName: 'Zafiro', jewelIcon: '🔷', colorHex: '#3b82f6' },
      { color: 2, emoteName: 'Moogle Ebrio', emoteIcon: '/emotes/1150642794990403594.webp', jewelName: 'Esmeralda', jewelIcon: '🟢', colorHex: '#10b981' },
      { color: 3, emoteName: 'Moogle Mareado', emoteIcon: '/emotes/1536895960461086830.webp', jewelName: 'Topacio', jewelIcon: '🟡', colorHex: '#f59e0b' },
      { color: 4, emoteName: 'Moogle K.O.', emoteIcon: '/emotes/1536895952793636944.webp', jewelName: 'Amatista', jewelIcon: '🟣', colorHex: '#a855f7' },
    ],
  },
  travesia_corsaria: {
    id: 'travesia_corsaria',
    name: 'Travesía Corsaria',
    description: 'Númenórë y Nunca Jamás - Memes piratas, armas y humor de alta mar',
    colors: [
      { color: 0, emoteName: 'Moogle Pistola', emoteIcon: '/emotes/1149873066608951326.webp', jewelName: 'Rubí', jewelIcon: '🔴', colorHex: '#ef4444' },
      { color: 1, emoteName: 'Moogle Gulag', emoteIcon: '/emotes/1187942067784130670.webp', jewelName: 'Zafiro', jewelIcon: '🔷', colorHex: '#3b82f6' },
      { color: 2, emoteName: 'Periódico Meme', emoteIcon: '/emotes/1217259343351779458.webp', jewelName: 'Esmeralda', jewelIcon: '🟢', colorHex: '#10b981' },
      { color: 3, emoteName: 'Gato Bostezo', emoteIcon: '/emotes/1290841162990485514.webp', jewelName: 'Topacio', jewelIcon: '🟡', colorHex: '#f59e0b' },
      { color: 4, emoteName: 'Moogle Gafas de Sol', emoteIcon: '/emotes/1115037240410775582.webp', jewelName: 'Amatista', jewelIcon: '🟣', colorHex: '#a855f7' },
    ],
  },
  tierras_infinitas: {
    id: 'tierras_infinitas',
    name: 'Tierras Infinitas',
    description: 'Tierras Infinitas - Olimpo cósmico, meditación zen y picardía',
    colors: [
      { color: 0, emoteName: 'Moogle Carcajada', emoteIcon: '/emotes/1092636199253975181.webp', jewelName: 'Rubí', jewelIcon: '🔴', colorHex: '#ef4444' },
      { color: 1, emoteName: 'Moogle Desorbitado', emoteIcon: '/emotes/1186866512364052501.webp', jewelName: 'Zafiro', jewelIcon: '🔷', colorHex: '#3b82f6' },
      { color: 2, emoteName: 'Moogle Serio', emoteIcon: '/emotes/1092636222695931984.webp', jewelName: 'Esmeralda', jewelIcon: '🟢', colorHex: '#10b981' },
      { color: 3, emoteName: 'Moogle Zen', emoteIcon: '/emotes/1536895959777284196.webp', jewelName: 'Topacio', jewelIcon: '🟡', colorHex: '#f59e0b' },
      { color: 4, emoteName: 'Moogle Pícaro', emoteIcon: '/emotes/1187942067087884298.webp', jewelName: 'Amatista', jewelIcon: '🟣', colorHex: '#a855f7' },
    ],
  },
};

export const DEFAULT_COLOR_METADATA = EMOTE_SETS.elenco_original.colors;

export function getEmoteSetForLevel(level: number): EmoteSet {
  if (level <= 4) {
    // Niveles 1-4: Praderas del Valle
    return EMOTE_SETS.elenco_original;
  } else if (level <= 8) {
    // Niveles 5-8: Colinas del Atardecer
    return EMOTE_SETS.show_palomitas;
  } else if (level <= 12) {
    // Niveles 9-12: Caverna de Cristales
    return EMOTE_SETS.ciudadela_arcana;
  } else if (level <= 16) {
    // Niveles 13-16: Bosque de las Luciérnagas
    return EMOTE_SETS.noche_magica;
  } else if (level <= 20) {
    // Niveles 17-20: Monte del Destino
    return EMOTE_SETS.forja_volcan;
  } else if (level <= 24) {
    // Niveles 21-24: Erebor
    return EMOTE_SETS.forja_volcan;
  } else if (level <= 28) {
    // Niveles 25-28: Númenórë
    return EMOTE_SETS.travesia_corsaria;
  } else if (level <= 32) {
    // Niveles 29-32: Pixie Hollow
    return EMOTE_SETS.noche_magica;
  } else if (level <= 36) {
    // Niveles 33-36: Nunca Jamás
    return EMOTE_SETS.travesia_corsaria;
  } else if (level <= 40) {
    // Niveles 37-40: Monte Vesubio
    return EMOTE_SETS.ciudadela_arcana;
  } else {
    // Niveles 41+: Tierras Infinitas
    return EMOTE_SETS.tierras_infinitas;
  }
}
