import type { Locale } from '../constants';
import { extraTranslations } from './extra';
import { siteUiCorrections } from './extra/site-ui/corrections';
import { siteUiContextOverrides } from './extra/site-ui/context';
import { siteUiCompletion } from './extra/site-ui/completion';

// Columns: English source, German, Spanish, French, Indonesian, Japanese,
// Korean, Portuguese (Brazil), Thai, Simplified Chinese. Game text never uses this table.
const rows = [
  ['Project story', 'Projektgeschichte', 'Historia del proyecto', 'Histoire du projet', 'Kisah proyek', 'プロジェクトの歩み', '프로젝트 이야기', 'História do projeto', 'เรื่องราวของโปรเจกต์', '项目历程'],
  ['Tower of Fantasy encyclopedia', 'Tower of Fantasy Enzyklopädie', 'Enciclopedia de Tower of Fantasy', 'Encyclopédie de Tower of Fantasy', 'Ensiklopedia Tower of Fantasy', 'Tower of Fantasy 百科事典', '타워 오브 판타지 백과사전', 'Enciclopédia de Tower of Fantasy', 'สารานุกรม Tower of Fantasy', '幻塔百科'],
  ['Tower of Fantasy tools', 'Tower of Fantasy Werkzeuge', 'Herramientas de Tower of Fantasy', 'Outils Tower of Fantasy', 'Alat Tower of Fantasy', 'Tower of Fantasy ツール', '타워 오브 판타지 도구', 'Ferramentas de Tower of Fantasy', 'เครื่องมือ Tower of Fantasy', '幻塔工具'],
  ['Tower of Fantasy archive', 'Tower of Fantasy Archiv', 'Archivo de Tower of Fantasy', 'Archives de Tower of Fantasy', 'Arsip Tower of Fantasy', 'Tower of Fantasy アーカイブ', '타워 오브 판타지 자료실', 'Arquivo de Tower of Fantasy', 'คลังข้อมูล Tower of Fantasy', '幻塔资料库'],
  ['Copy Path', 'Pfad kopieren', 'Copiar ruta', 'Copier le chemin', 'Salin jalur', 'パスをコピー', '경로 복사', 'Copiar caminho', 'คัดลอกพาธ', '复制路径'],
  ['Copy Unreal Path', 'Unreal-Pfad kopieren', 'Copiar ruta de Unreal', 'Copier le chemin Unreal', 'Salin jalur Unreal', 'Unrealパスをコピー', '언리얼 경로 복사', 'Copiar caminho do Unreal', 'คัดลอกพาธ Unreal', '复制 Unreal 路径'],
  ['Zoom', 'Zoom', 'Ampliar', 'Zoom', 'Perbesar', 'ズーム', '확대', 'Zoom', 'ซูม', '缩放'],
  ['Resolution', 'Auflösung', 'Resolución', 'Résolution', 'Resolusi', '解像度', '해상도', 'Resolução', 'ความละเอียด', '分辨率'],
  ['File Size', 'Dateigröße', 'Tamaño del archivo', 'Taille du fichier', 'Ukuran berkas', 'ファイルサイズ', '파일 크기', 'Tamanho do arquivo', 'ขนาดไฟล์', '文件大小'],
  ['Game File', 'Spieldatei', 'Archivo del juego', 'Fichier du jeu', 'Berkas game', 'ゲームファイル', '게임 파일', 'Arquivo do jogo', 'ไฟล์เกม', '游戏文件'],
  ['Previous image', 'Vorheriges Bild', 'Imagen anterior', 'Image précédente', 'Gambar sebelumnya', '前の画像', '이전 이미지', 'Imagem anterior', 'ภาพก่อนหน้า', '上一张图片'],
  ['Next image', 'Nächstes Bild', 'Imagen siguiente', 'Image suivante', 'Gambar berikutnya', '次の画像', '다음 이미지', 'Próxima imagem', 'ภาพถัดไป', '下一张图片'],
  ['Toggle image zoom', 'Bildzoom umschalten', 'Cambiar el zoom de la imagen', 'Modifier le zoom de l’image', 'Ubah zoom gambar', '画像のズームを切り替え', '이미지 확대 전환', 'Alternar zoom da imagem', 'สลับการซูมภาพ', '切换图片缩放'],
  ['✓ Downloaded!', '✓ Heruntergeladen!', '✓ ¡Descargado!', '✓ Téléchargé !', '✓ Diunduh!', '✓ ダウンロード完了', '✓ 다운로드 완료', '✓ Baixado!', '✓ ดาวน์โหลดแล้ว!', '✓ 已下载！'],
  ['Site sections', 'Website-Bereiche', 'Secciones del sitio', 'Sections du site', 'Bagian situs', 'サイトのセクション', '사이트 섹션', 'Seções do site', 'ส่วนต่าง ๆ ของเว็บไซต์', '网站栏目'],
  ['Main hub', 'Startseite', 'Inicio', 'Accueil', 'Beranda', 'ホーム', '홈', 'Início', 'หน้าหลัก', '首页'],
  ['Catalog sections', 'Katalogbereiche', 'Secciones del catálogo', 'Sections du catalogue', 'Bagian katalog', 'カタログのセクション', '카탈로그 섹션', 'Seções do catálogo', 'หมวดหมู่แค็ตตาล็อก', '图鉴栏目'],
  ['Datamine sections', 'Datamine-Bereiche', 'Secciones de datamine', 'Sections de datamine', 'Bagian datamine', 'データ解析のセクション', '데이터 분석 섹션', 'Seções de datamine', 'หมวดหมู่ดาต้าไมน์', '数据挖掘栏目'],
  ['Search simulacra or weapon...', 'Simulacren oder Waffen suchen...', 'Buscar simulacros o armas...', 'Rechercher un simulacre ou une arme...', 'Cari simulacra atau senjata...', 'アバターや武器を検索...', '레플리카 또는 무기 검색...', 'Buscar simulacros ou armas...', 'ค้นหาซิมูลาครัมหรืออาวุธ...', '搜索拟态或武器...'],
  ['Name: A → Z', 'Name: A → Z', 'Nombre: A → Z', 'Nom : A → Z', 'Nama: A → Z', '名前：昇順', '이름: 오름차순', 'Nome: A → Z', 'ชื่อ: A → Z', '名称：升序'],
  ['Name: Z → A', 'Name: Z → A', 'Nombre: Z → A', 'Nom : Z → A', 'Nama: Z → A', '名前：降順', '이름: 내림차순', 'Nome: Z → A', 'ชื่อ: Z → A', '名称：降序'],
  ['Release: New → Old', 'Veröffentlichung: Neu → Alt', 'Lanzamiento: reciente → antiguo', 'Sortie : récent → ancien', 'Rilis: Baru → Lama', '実装順：新しい順', '출시: 최신순', 'Lançamento: recente → antigo', 'วันเปิดตัว: ใหม่ → เก่า', '推出时间：新 → 旧'],
  ['Release: Old → New', 'Veröffentlichung: Alt → Neu', 'Lanzamiento: antiguo → reciente', 'Sortie : ancien → récent', 'Rilis: Lama → Baru', '実装順：古い順', '출시: 오래된 순', 'Lançamento: antigo → recente', 'วันเปิดตัว: เก่า → ใหม่', '推出时间：旧 → 新'],
  ['View profile', 'Profil ansehen', 'Ver perfil', 'Voir le profil', 'Lihat profil', 'プロフィールを見る', '프로필 보기', 'Ver perfil', 'ดูโปรไฟล์', '查看档案'],
  ['No simulacra found', 'Keine Simulacren gefunden', 'No se encontraron simulacros', 'Aucun simulacre trouvé', 'Simulacra tidak ditemukan', 'アバターが見つかりません', '레플리카를 찾을 수 없습니다', 'Nenhum simulacro encontrado', 'ไม่พบซิมูลาครัม', '未找到拟态'],
  ['Weapon', 'Waffe', 'Arma', 'Arme', 'Senjata', '武器', '무기', 'Arma', 'อาวุธ', '武器'],
  ['Skills & Buffs', 'Fähigkeiten & Buffs', 'Habilidades y mejoras', 'Compétences et bonus', 'Skill & Buff', 'スキルとバフ', '스킬 및 버프', 'Habilidades e bônus', 'สกิลและบัฟ', '技能与增益'],
  ['Dormitory', 'Wohnheim', 'Dormitorio', 'Dortoir', 'Asrama', '寮', '숙소', 'Dormitório', 'หอพัก', '宿舍'],
  ['Search', 'Suchen', 'Buscar', 'Rechercher', 'Cari', '検索', '검색', 'Buscar', 'ค้นหา', '搜索'],
  ['Search by name...', 'Nach Namen suchen...', 'Buscar por nombre...', 'Rechercher par nom...', 'Cari berdasarkan nama...', '名前で検索...', '이름으로 검색...', 'Buscar por nome...', 'ค้นหาตามชื่อ...', '按名称搜索...'],
  ['Sort by', 'Sortieren nach', 'Ordenar por', 'Trier par', 'Urutkan menurut', '並び順', '정렬 기준', 'Ordenar por', 'เรียงตาม', '排序方式'],
  ['Reset filters', 'Filter zurücksetzen', 'Restablecer filtros', 'Réinitialiser les filtres', 'Atur ulang filter', 'フィルターをリセット', '필터 초기화', 'Redefinir filtros', 'รีเซ็ตตัวกรอง', '重置筛选'],
  ['All', 'Alle', 'Todos', 'Tout', 'Semua', 'すべて', '전체', 'Todos', 'ทั้งหมด', '全部'],
  ['Loading...', 'Wird geladen...', 'Cargando...', 'Chargement...', 'Memuat...', '読み込み中...', '불러오는 중...', 'Carregando...', 'กำลังโหลด...', '正在加载...'],
  ['Try again', 'Erneut versuchen', 'Reintentar', 'Réessayer', 'Coba lagi', '再試行', '다시 시도', 'Tentar novamente', 'ลองอีกครั้ง', '重试'],
  ['Close', 'Schließen', 'Cerrar', 'Fermer', 'Tutup', '閉じる', '닫기', 'Fechar', 'ปิด', '关闭'],
  ['Cancel', 'Abbrechen', 'Cancelar', 'Annuler', 'Batal', 'キャンセル', '취소', 'Cancelar', 'ยกเลิก', '取消'],
  ['Save', 'Speichern', 'Guardar', 'Enregistrer', 'Simpan', '保存', '저장', 'Salvar', 'บันทึก', '保存'],
  ['Apply', 'Anwenden', 'Aplicar', 'Appliquer', 'Terapkan', '適用', '적용', 'Aplicar', 'นำไปใช้', '应用'],
  ['Reset', 'Zurücksetzen', 'Restablecer', 'Réinitialiser', 'Atur ulang', 'リセット', '초기화', 'Redefinir', 'รีเซ็ต', '重置'],
  ['Clear', 'Leeren', 'Borrar', 'Effacer', 'Hapus', 'クリア', '지우기', 'Limpar', 'ล้าง', '清除'],
  ['Copy', 'Kopieren', 'Copiar', 'Copier', 'Salin', 'コピー', '복사', 'Copiar', 'คัดลอก', '复制'],
  ['Copied', 'Kopiert', 'Copiado', 'Copié', 'Disalin', 'コピーしました', '복사됨', 'Copiado', 'คัดลอกแล้ว', '已复制'],
  ['Download', 'Herunterladen', 'Descargar', 'Télécharger', 'Unduh', 'ダウンロード', '다운로드', 'Baixar', 'ดาวน์โหลด', '下载'],
  ['Download PNG', 'PNG herunterladen', 'Descargar PNG', 'Télécharger le PNG', 'Unduh PNG', 'PNGをダウンロード', 'PNG 다운로드', 'Baixar PNG', 'ดาวน์โหลด PNG', '下载 PNG'],
  ['Download WebP', 'WebP herunterladen', 'Descargar WebP', 'Télécharger le WebP', 'Unduh WebP', 'WebPをダウンロード', 'WebP 다운로드', 'Baixar WebP', 'ดาวน์โหลด WebP', '下载 WebP'],
  ['Import', 'Importieren', 'Importar', 'Importer', 'Impor', 'インポート', '가져오기', 'Importar', 'นำเข้า', '导入'],
  ['Export', 'Exportieren', 'Exportar', 'Exporter', 'Ekspor', 'エクスポート', '내보내기', 'Exportar', 'ส่งออก', '导出'],
  ['Share', 'Teilen', 'Compartir', 'Partager', 'Bagikan', '共有', '공유', 'Compartilhar', 'แชร์', '分享'],
  ['Settings', 'Einstellungen', 'Ajustes', 'Paramètres', 'Pengaturan', '設定', '설정', 'Configurações', 'การตั้งค่า', '设置'],
  ['Filters', 'Filter', 'Filtros', 'Filtres', 'Filter', 'フィルター', '필터', 'Filtros', 'ตัวกรอง', '筛选'],
  ['Name', 'Name', 'Nombre', 'Nom', 'Nama', '名前', '이름', 'Nome', 'ชื่อ', '名称'],
  ['Description', 'Beschreibung', 'Descripción', 'Description', 'Deskripsi', '説明', '설명', 'Descrição', 'คำอธิบาย', '描述'],
  ['Details', 'Details', 'Detalles', 'Détails', 'Detail', '詳細', '상세 정보', 'Detalhes', 'รายละเอียด', '详情'],
  ['No results', 'Keine Ergebnisse', 'Sin resultados', 'Aucun résultat', 'Tidak ada hasil', '結果がありません', '결과 없음', 'Nenhum resultado', 'ไม่พบผลลัพธ์', '无结果'],
  ['No data', 'Keine Daten', 'Sin datos', 'Aucune donnée', 'Tidak ada data', 'データがありません', '데이터 없음', 'Sem dados', 'ไม่มีข้อมูล', '暂无数据'],
  ['Unknown', 'Unbekannt', 'Desconocido', 'Inconnu', 'Tidak diketahui', '不明', '알 수 없음', 'Desconhecido', 'ไม่ทราบ', '未知'],
  ['Unavailable', 'Nicht verfügbar', 'No disponible', 'Indisponible', 'Tidak tersedia', '利用できません', '사용 불가', 'Indisponível', 'ไม่พร้อมใช้งาน', '不可用'],
  ['Previous', 'Zurück', 'Anterior', 'Précédent', 'Sebelumnya', '前へ', '이전', 'Anterior', 'ก่อนหน้า', '上一项'],
  ['Next', 'Weiter', 'Siguiente', 'Suivant', 'Berikutnya', '次へ', '다음', 'Próximo', 'ถัดไป', '下一项'],
  ['Back', 'Zurück', 'Volver', 'Retour', 'Kembali', '戻る', '뒤로', 'Voltar', 'ย้อนกลับ', '返回'],
  ['Level', 'Stufe', 'Nivel', 'Niveau', 'Level', 'レベル', '레벨', 'Nível', 'เลเวล', '等级'],
  ['Rarity', 'Seltenheit', 'Rareza', 'Rareté', 'Kelangkaan', 'レアリティ', '등급', 'Raridade', 'ระดับความหายาก', '稀有度'],
  ['Element', 'Element', 'Elemento', 'Élément', 'Elemen', '属性', '속성', 'Elemento', 'ธาตุ', '属性'],
  ['Role', 'Rolle', 'Rol', 'Rôle', 'Peran', '役割', '역할', 'Função', 'บทบาท', '定位'],
  ['Type', 'Typ', 'Tipo', 'Type', 'Jenis', '種類', '유형', 'Tipo', 'ประเภท', '类型'],
  ['Quality', 'Qualität', 'Calidad', 'Qualité', 'Kualitas', '品質', '품질', 'Qualidade', 'คุณภาพ', '品质'],
  ['Effects', 'Effekte', 'Efectos', 'Effets', 'Efek', '効果', '효과', 'Efeitos', 'เอฟเฟกต์', '效果'],
  ['Base effect', 'Grundeffekt', 'Efecto base', 'Effet de base', 'Efek dasar', '基本効果', '기본 효과', 'Efeito base', 'เอฟเฟกต์พื้นฐาน', '基础效果'],
  ['Stats', 'Werte', 'Estadísticas', 'Statistiques', 'Statistik', 'ステータス', '능력치', 'Atributos', 'ค่าสถานะ', '属性数据'],
  ['Sources', 'Quellen', 'Fuentes', 'Sources', 'Sumber', '出典', '출처', 'Fontes', 'แหล่งข้อมูล', '来源'],
  ['Updated', 'Aktualisiert', 'Actualizado', 'Mis à jour', 'Diperbarui', '更新日', '업데이트', 'Atualizado', 'อัปเดต', '更新时间'],
  ['Last update', 'Letzte Aktualisierung', 'Última actualización', 'Dernière mise à jour', 'Pembaruan terakhir', '最終更新', '최근 업데이트', 'Última atualização', 'อัปเดตล่าสุด', '最近更新'],
  ['Version', 'Version', 'Versión', 'Version', 'Versi', 'バージョン', '버전', 'Versão', 'เวอร์ชัน', '版本'],
  ['Global', 'Global', 'Global', 'Global', 'Global', 'グローバル', '글로벌', 'Global', 'โกลบอล', '国际服'],
  ['Info', 'Datenbank', 'Información', 'Encyclopédie', 'Info', '図鑑', '도감', 'Informações', 'ข้อมูล', '资料库'],
  ['Tools', 'Werkzeuge', 'Herramientas', 'Outils', 'Alat', 'ツール', '도구', 'Ferramentas', 'เครื่องมือ', '工具'],
  ['Datamine', 'Datamine', 'Datamine', 'Datamine', 'Datamine', 'データ解析', '데이터 분석', 'Datamine', 'ข้อมูลดาต้าไมน์', '数据挖掘'],
  ['Simulacra', 'Simulacren', 'Simulacros', 'Simulacres', 'Simulacra', 'アバター', '레플리카', 'Simulacros', 'ซิมูลาครัม', '拟态'],
  ['Weapons', 'Waffen', 'Armas', 'Armes', 'Senjata', '武器', '무기', 'Armas', 'อาวุธ', '武器'],
  ['Matrices', 'Matrizen', 'Matrices', 'Matrices', 'Matriks', 'ボリション', '칩셋', 'Matrizes', 'เมทริกซ์', '意志'],
  ['Relics', 'Relikte', 'Reliquias', 'Reliques', 'Relik', 'アルケー', '기어', 'Relíquias', 'รีลิก', '源器'],
  ['Pets', 'Begleiter', 'Mascotas', 'Compagnons', 'Peliharaan', 'ペット', '펫', 'Mascotes', 'สัตว์เลี้ยง', '宠物'],
  ['Food', 'Essen', 'Comida', 'Cuisine', 'Makanan', '料理', '요리', 'Comida', 'อาหาร', '食物'],
  ['Cosmetics', 'Kosmetik', 'Cosméticos', 'Apparences', 'Kosmetik', '外観', '외형', 'Cosméticos', 'ของตกแต่ง', '外观'],
  ['Arts', 'Illustrationen', 'Ilustraciones', 'Illustrations', 'Ilustrasi', 'イラスト', '일러스트', 'Ilustrações', 'ภาพอาร์ต', '原画'],
  ['Bosses', 'Bosse', 'Jefes', 'Boss', 'Bos', 'ボス', '보스', 'Chefes', 'บอส', '首领'],
  ['Items', 'Gegenstände', 'Objetos', 'Objets', 'Item', 'アイテム', '아이템', 'Itens', 'ไอเทม', '物品'],
  ['Raids', 'Raids', 'Incursiones', 'Raids', 'Raid', 'レイド', '레이드', 'Raides', 'เรด', '团队副本'],
  ['Handbook', 'Handbuch', 'Manual', 'Manuel', 'Panduan', 'ハンドブック', '핸드북', 'Manual', 'คู่มือ', '手册'],
  ['Build', 'Build', 'Configuración', 'Équipement', 'Build', 'ビルド', '빌드', 'Build', 'บิลด์', '配装'],
  ['Ranking', 'Rangliste', 'Clasificación', 'Classement', 'Peringkat', 'ランキング', '랭킹', 'Classificação', 'อันดับ', '排行榜'],
  ['Optimizer', 'Optimierer', 'Optimizador', 'Optimiseur', 'Pengoptimal', '最適化ツール', '최적화', 'Otimizador', 'เครื่องมือเพิ่มประสิทธิภาพ', '配装优化'],
  ['Wish Tracker', 'Bestellverlauf', 'Historial de pedidos', 'Suivi des commandes', 'Pelacak Pesanan', 'ガチャ履歴', '뽑기 기록', 'Histórico de pedidos', 'ประวัติการสั่งพิเศษ', '抽卡记录'],
  ['Profiles', 'Profile', 'Perfiles', 'Profils', 'Profil', 'プロフィール', '프로필', 'Perfis', 'โปรไฟล์', '档案'],
  ['Players', 'Spieler', 'Jugadores', 'Joueurs', 'Pemain', 'プレイヤー', '플레이어', 'Jogadores', 'ผู้เล่น', '玩家'],
  ['Server', 'Server', 'Servidor', 'Serveur', 'Server', 'サーバー', '서버', 'Servidor', 'เซิร์ฟเวอร์', '服务器'],
  ['Region', 'Region', 'Región', 'Région', 'Wilayah', '地域', '지역', 'Região', 'ภูมิภาค', '地区'],
  ['Language selector', 'Sprache auswählen', 'Seleccionar idioma', 'Choisir la langue', 'Pilih bahasa', '言語を選択', '언어 선택', 'Selecionar idioma', 'เลือกภาษา', '选择语言'],
  ['Language selector: {{lang}}', 'Sprache auswählen: {{lang}}', 'Seleccionar idioma: {{lang}}', 'Choisir la langue : {{lang}}', 'Pilih bahasa: {{lang}}', '言語を選択：{{lang}}', '언어 선택: {{lang}}', 'Selecionar idioma: {{lang}}', 'เลือกภาษา: {{lang}}', '选择语言：{{lang}}'],
  ['Language: {{code}}', 'Sprache: {{code}}', 'Idioma: {{code}}', 'Langue : {{code}}', 'Bahasa: {{code}}', '言語：{{code}}', '언어: {{code}}', 'Idioma: {{code}}', 'ภาษา: {{code}}', '语言：{{code}}'],
  ['Skip to main content', 'Zum Hauptinhalt springen', 'Ir al contenido principal', 'Aller au contenu principal', 'Lewati ke konten utama', 'メインコンテンツへ移動', '본문으로 건너뛰기', 'Ir para o conteúdo principal', 'ข้ามไปยังเนื้อหาหลัก', '跳转到主要内容'],
  ['Scroll left', 'Nach links scrollen', 'Desplazar a la izquierda', 'Défiler vers la gauche', 'Gulir ke kiri', '左にスクロール', '왼쪽으로 스크롤', 'Rolar para a esquerda', 'เลื่อนไปทางซ้าย', '向左滚动'],
  ['Scroll right', 'Nach rechts scrollen', 'Desplazar a la derecha', 'Défiler vers la droite', 'Gulir ke kanan', '右にスクロール', '오른쪽으로 스크롤', 'Rolar para a direita', 'เลื่อนไปทางขวา', '向右滚动'],
  ['Scroll to top of page', 'Zum Seitenanfang', 'Volver al inicio de la página', 'Retour en haut de la page', 'Gulir ke atas halaman', 'ページの先頭へ', '페이지 맨 위로', 'Voltar ao topo da página', 'เลื่อนไปด้านบนของหน้า', '返回页面顶部'],
  ['Site information', 'Seiteninformationen', 'Información del sitio', 'Informations du site', 'Informasi situs', 'サイト情報', '사이트 정보', 'Informações do site', 'ข้อมูลเว็บไซต์', '网站信息'],
  ['About the data', 'Über die Daten', 'Acerca de los datos', 'À propos des données', 'Tentang data', 'データについて', '데이터 정보', 'Sobre os dados', 'เกี่ยวกับข้อมูล', '关于数据'],
  ['Changelog', 'Änderungsverlauf', 'Registro de cambios', 'Journal des modifications', 'Catatan perubahan', '更新履歴', '변경 내역', 'Histórico de alterações', 'บันทึกการเปลี่ยนแปลง', '更新日志'],
  ['Help update data', 'Daten aktualisieren helfen', 'Ayudar a actualizar datos', 'Aider à mettre à jour les données', 'Bantu perbarui data', 'データ更新に協力', '데이터 업데이트 돕기', 'Ajudar a atualizar os dados', 'ช่วยอัปเดตข้อมูล', '协助更新数据'],
  ['Privacy', 'Datenschutz', 'Privacidad', 'Confidentialité', 'Privasi', 'プライバシー', '개인정보 보호', 'Privacidade', 'ความเป็นส่วนตัว', '隐私'],
  ['Privacy Policy', 'Datenschutzerklärung', 'Política de privacidad', 'Politique de confidentialité', 'Kebijakan privasi', 'プライバシーポリシー', '개인정보 처리방침', 'Política de privacidade', 'นโยบายความเป็นส่วนตัว', '隐私政策'],
  ['TOF resources', 'TOF-Ressourcen', 'Recursos de TOF', 'Ressources TOF', 'Sumber TOF', 'TOF関連サイト', 'TOF 자료', 'Recursos de TOF', 'แหล่งข้อมูล TOF', '幻塔资源'],
  ['Return to TOF Hub', 'Zurück zu TOF Hub', 'Volver a TOF Hub', 'Retour à TOF Hub', 'Kembali ke TOF Hub', 'TOF Hubに戻る', 'TOF Hub로 돌아가기', 'Voltar ao TOF Hub', 'กลับไปที่ TOF Hub', '返回 TOF Hub'],
  ['Back to the hub', 'Zurück zur Startseite', 'Volver al inicio', 'Retour à l’accueil', 'Kembali ke beranda', 'ホームに戻る', '홈으로 돌아가기', 'Voltar ao início', 'กลับสู่หน้าหลัก', '返回首页'],
  ['Error', 'Fehler', 'Error', 'Erreur', 'Kesalahan', 'エラー', '오류', 'Erro', 'ข้อผิดพลาด', '错误'],
  ['Reference', 'Referenz', 'Referencia', 'Référence', 'Referensi', '参照番号', '참조 번호', 'Referência', 'รหัสอ้างอิง', '参考编号'],
  ['Technical details', 'Technische Details', 'Detalles técnicos', 'Détails techniques', 'Detail teknis', '技術的な詳細', '기술 세부 정보', 'Detalhes técnicos', 'รายละเอียดทางเทคนิค', '技术详情'],
  ['Loading {{section}}…', '{{section}} wird geladen…', 'Cargando {{section}}…', 'Chargement : {{section}}…', 'Memuat {{section}}…', '{{section}}を読み込み中…', '{{section}} 불러오는 중…', 'Carregando {{section}}…', 'กำลังโหลด {{section}}…', '正在加载{{section}}…'],
  ['This page failed to load', 'Diese Seite konnte nicht geladen werden', 'No se pudo cargar esta página', 'Impossible de charger cette page', 'Halaman ini gagal dimuat', 'ページを読み込めませんでした', '페이지를 불러오지 못했습니다', 'Não foi possível carregar esta página', 'ไม่สามารถโหลดหน้านี้ได้', '此页面加载失败'],
  ['Nothing at this address', 'Unter dieser Adresse wurde nichts gefunden', 'No hay nada en esta dirección', 'Aucun contenu à cette adresse', 'Tidak ada halaman di alamat ini', 'このアドレスにはページがありません', '이 주소에 페이지가 없습니다', 'Não há nada neste endereço', 'ไม่พบหน้าที่อยู่ตามที่อยู่นี้', '此地址没有内容'],
  ['The site failed to start', 'Die Website konnte nicht gestartet werden', 'No se pudo iniciar el sitio', 'Le site n’a pas pu démarrer', 'Situs gagal dimulai', 'サイトを起動できませんでした', '사이트를 시작하지 못했습니다', 'Não foi possível iniciar o site', 'ไม่สามารถเริ่มเว็บไซต์ได้', '网站启动失败'],
  ['Version unavailable', 'Version nicht verfügbar', 'Versión no disponible', 'Version indisponible', 'Versi tidak tersedia', 'バージョン情報なし', '버전 정보 없음', 'Versão indisponível', 'ไม่มีข้อมูลเวอร์ชัน', '暂无版本信息'],
  ['Dataset snapshot', 'Datenstand', 'Instantánea de datos', 'Instantané des données', 'Snapshot data', 'データのスナップショット', '데이터 스냅샷', 'Snapshot dos dados', 'สแนปช็อตข้อมูล', '数据快照'],
  ['Export details', 'Exportdetails', 'Detalles de exportación', 'Détails de l’export', 'Detail ekspor', 'エクスポート詳細', '내보내기 상세 정보', 'Detalhes da exportação', 'รายละเอียดการส่งออก', '导出详情'],
  ['Update available', 'Update verfügbar', 'Actualización disponible', 'Mise à jour disponible', 'Pembaruan tersedia', '更新があります', '업데이트 가능', 'Atualização disponível', 'มีอัปเดตใหม่', '有可用更新'],
  ['How to help →', 'So kannst du helfen →', 'Cómo ayudar →', 'Comment aider →', 'Cara membantu →', '協力方法 →', '도움 방법 →', 'Como ajudar →', 'วิธีช่วยเหลือ →', '如何参与 →'],
  ['Encyclopedia', 'Enzyklopädie', 'Enciclopedia', 'Encyclopédie', 'Ensiklopedia', '百科事典', '백과사전', 'Enciclopédia', 'สารานุกรม', '百科'],
  ['Info Hub', 'Datenbank', 'Centro de información', 'Encyclopédie', 'Pusat Info', '情報ハブ', '정보 허브', 'Central de informações', 'ศูนย์ข้อมูล', '资料中心'],
  ['Game Data', 'Spieldaten', 'Datos del juego', 'Données du jeu', 'Data Game', 'ゲームデータ', '게임 데이터', 'Dados do jogo', 'ข้อมูลเกม', '游戏数据'],
  ['Datamine Archive', 'Datamine-Archiv', 'Archivo de datamine', 'Archives de datamine', 'Arsip Datamine', 'データ解析アーカイブ', '데이터 분석 자료실', 'Arquivo de datamine', 'คลังดาต้าไมน์', '数据挖掘档案'],
  ['Simulacra & Weapons', 'Simulacren & Waffen', 'Simulacros y armas', 'Simulacres et armes', 'Simulacra & Senjata', 'アバターと武器', '레플리카 및 무기', 'Simulacros e armas', 'ซิมูลาครัมและอาวุธ', '拟态与武器'],
  ['Matrices Database', 'Matrizen-Datenbank', 'Base de datos de matrices', 'Base de données des matrices', 'Basis Data Matriks', 'ボリションデータベース', '칩셋 데이터베이스', 'Banco de dados de matrizes', 'ฐานข้อมูลเมทริกซ์', '意志数据库'],
  ['Relics Database', 'Relikt-Datenbank', 'Base de datos de reliquias', 'Base de données des reliques', 'Basis Data Relik', 'アルケーデータベース', '기어 데이터베이스', 'Banco de dados de relíquias', 'ฐานข้อมูลรีลิก', '源器数据库'],
  ['Smart Servants', 'Smart-Servants', 'Asistentes inteligentes', 'Serviteurs intelligents', 'Smart Servant', 'スマートサーバント', '스마트 서번트', 'Servos inteligentes', 'สมาร์ทเซอร์แวนต์', '智仆'],
  ['Food Recipes', 'Rezepte', 'Recetas', 'Recettes de cuisine', 'Resep Makanan', '料理レシピ', '요리 레시피', 'Receitas', 'สูตรอาหาร', '食谱'],
  ['Cosmetics Gallery', 'Kosmetik-Galerie', 'Galería de cosméticos', 'Galerie des apparences', 'Galeri Kosmetik', '外観ギャラリー', '외형 갤러리', 'Galeria de cosméticos', 'แกลเลอรีของตกแต่ง', '外观图鉴'],
  ['Artworks Gallery', 'Illustrationen-Galerie', 'Galería de ilustraciones', 'Galerie d’illustrations', 'Galeri Ilustrasi', 'イラストギャラリー', '일러스트 갤러리', 'Galeria de ilustrações', 'แกลเลอรีภาพอาร์ต', '原画图鉴'],
  ['Boss Mechanics', 'Bossmechaniken', 'Mecánicas de jefes', 'Mécaniques des boss', 'Mekanik Bos', 'ボスギミック', '보스 기믹', 'Mecânicas dos chefes', 'กลไกบอส', '首领机制'],
] as const;

const columns = ['de', 'es', 'fr', 'id', 'ja', 'ko', 'pt', 'th', 'zh-CN'] as const;
export const uiTranslations: Partial<Record<Locale, Readonly<Record<string, string>>>> = Object.fromEntries(
  columns.map((locale, index) => [locale, Object.fromEntries(rows.flatMap(row => [[row[0], row[index + 1]], [row[0].toLowerCase(), row[index + 1]]]))]),
);
for (const [locale, extra] of Object.entries(extraTranslations)) {
  const target = (uiTranslations[locale as Locale] ??= {}) as Record<string, string>;
  for (const [source, text] of Object.entries(extra)) {
    target[source] ??= text;
    target[source.toLowerCase()] ??= text;
  }
}
for (const [locale, additions] of Object.entries(siteUiCompletion)) {
  const target = (uiTranslations[locale as Locale] ??= {}) as Record<string, string>;
  for (const [source, text] of Object.entries(additions)) {
    target[source] = text;
    target[source.toLowerCase()] = text;
  }
}
// These reviewed site-owned phrases outrank game names and generic fallback labels when they collide.
for (const [locale, corrections] of Object.entries(siteUiCorrections)) {
  const target = (uiTranslations[locale as Locale] ??= {}) as Record<string, string>;
  for (const [source, text] of Object.entries(corrections)) {
    target[source] = text;
    target[source.toLowerCase()] = text;
  }
}
for (const [locale, corrections] of Object.entries(siteUiContextOverrides)) {
  const target = (uiTranslations[locale as Locale] ??= {}) as Record<string, string>;
  for (const [source, text] of Object.entries(corrections)) {
    target[source] = text;
    target[source.toLowerCase()] = text;
  }
}
uiTranslations['zh-Hans'] = uiTranslations['zh-CN'];
uiTranslations['zh-Hans-SG'] = uiTranslations['zh-CN'];
