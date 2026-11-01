import type {Locale} from '../../../constants';

// Site-owned media controls; these labels do not establish any game facts.
const locales: Locale[] = ['ru', 'de', 'es', 'fr', 'id', 'ja', 'ko', 'pt', 'th', 'zh-CN'];
const rows = [
  ['Image unavailable', 'Изображение недоступно', 'Bild nicht verfügbar', 'Imagen no disponible', 'Image indisponible', 'Gambar tidak tersedia', '画像を表示できません', '이미지 없음', 'Imagem indisponível', 'ไม่มีภาพ', '图片暂不可用'],
  ['Chat Stickers', 'Стикеры чата', 'Chat-Sticker', 'Pegatinas de chat', 'Autocollants de chat', 'Stiker obrolan', 'チャットスタンプ', '채팅 스티커', 'Figurinhas do chat', 'สติกเกอร์แชต', '聊天表情'],
  ['Badges', 'Бейджики', 'Abzeichen', 'Insignias', 'Insignes', 'Lencana', 'バッジ', '배지', 'Emblemas', 'ตรา', '徽章'],
  ['Animated', 'Анимация', 'Animiert', 'Animado', 'Animé', 'Animasi', 'アニメーション', '애니메이션', 'Animado', 'ภาพเคลื่อนไหว', '动态'],
  ['Effect', 'Эффект', 'Effekt', 'Efecto', 'Effet', 'Efek', 'エフェクト', '효과', 'Efeito', 'เอฟเฟกต์', '特效'],
  ['Animation source found; playback is not available yet.', 'Источник анимации найден; воспроизведение пока недоступно.',
    'Animationsquelle gefunden; die Wiedergabe ist noch nicht verfügbar.', 'Se ha encontrado la fuente de animación; la reproducción aún no está disponible.',
    'Source d’animation trouvée ; la lecture n’est pas encore disponible.', 'Sumber animasi ditemukan; pemutaran belum tersedia.',
    'アニメーションの参照元が見つかりました。再生はまだ利用できません。', '애니메이션 소스를 찾았습니다. 아직 재생할 수 없습니다.',
    'Fonte de animação encontrada; a reprodução ainda não está disponível.', 'พบแหล่งภาพเคลื่อนไหวแล้ว แต่ยังไม่สามารถเล่นได้', '已找到动画源，暂时无法播放。'],
  ['Pause animation', 'Остановить анимацию', 'Animation pausieren', 'Pausar animación', 'Mettre l’animation en pause', 'Jeda animasi', 'アニメーションを一時停止', '애니메이션 일시 정지', 'Pausar animação', 'หยุดภาพเคลื่อนไหวชั่วคราว', '暂停动画'],
  ['Play animation', 'Включить анимацию', 'Animation abspielen', 'Reproducir animación', 'Lire l’animation', 'Putar animasi', 'アニメーションを再生', '애니메이션 재생', 'Reproduzir animação', 'เล่นภาพเคลื่อนไหว', '播放动画'],
  ['Download GIF', 'Скачать GIF', 'GIF herunterladen', 'Descargar GIF', 'Télécharger le GIF', 'Unduh GIF', 'GIFをダウンロード', 'GIF 다운로드', 'Baixar GIF', 'ดาวน์โหลด GIF', '下载 GIF'],
];
export const cosmeticMediaTranslations: Partial<Record<Locale, Readonly<Record<string, string>>>> = Object.fromEntries(
  locales.map((locale, index) => [locale, Object.fromEntries(rows.map(row => [row[0], row[index + 1]]))]),
);
