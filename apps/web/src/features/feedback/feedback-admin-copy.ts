import { createLocaleCopies } from '@tof-hub/i18n';

export const FEEDBACK_ADMIN_COPY = createLocaleCopies({
  en: {
    title: 'Site feedback', intro: 'Private ratings and suggestions from visitors.',
    key: 'Administrative key', unlock: 'View feedback', loginHint: 'Use FEEDBACK_ADMIN_KEY (or ADMIN_KEY) from the API configuration. The key stays in this tab’s memory and is cleared on exit or reload.',
    denied: 'Access denied. Check the administrative key.', error: 'Could not load feedback. Please try again.',
    loading: 'Loading feedback…', logout: 'Close private view', refresh: 'Refresh', retry: 'Retry',
    total: 'Submitted reviews', answered: 'Answers', median: 'Median', distribution: 'Score distribution', score: 'Score', count: 'Count',
    responses: 'Reviews', notes: 'Page messages', all: 'All pages', page: 'Filter by page', search: 'Find a page',
    empty: 'No reviews yet.', emptyNotes: 'No messages match this page.', ai: 'Comment about AI',
    noScores: 'No ratings in this review.', source: 'Source', language: 'Language', release: 'Release',
    sources: { footer: 'Footer', prompt: 'Invitation', direct: 'Direct link' },
    player: 'Character', noPlayer: 'No character linked', country: 'Country', unknownCountry: 'Unknown country', device: 'Device',
    devices: { desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet', unknown: 'Unknown' },
    previous: 'Previous batch', next: 'Next batch', batch: 'Batch', shown: 'Shown', messages: 'Messages',
    separate: 'Each page message is a separate feedback item. Scores belong to the review as a whole.',
  },
  ru: {
    title: 'Отзывы о сайте', intro: 'Закрытый просмотр оценок и пожеланий посетителей.',
    key: 'Административный ключ', unlock: 'Посмотреть отзывы', loginHint: 'Используйте FEEDBACK_ADMIN_KEY (или ADMIN_KEY) из настроек API. Ключ остаётся в памяти этой вкладки и очищается при выходе или перезагрузке.',
    denied: 'Доступ запрещён. Проверьте административный ключ.', error: 'Не удалось загрузить отзывы. Попробуйте ещё раз.',
    loading: 'Загружаем отзывы…', logout: 'Закрыть просмотр', refresh: 'Обновить', retry: 'Повторить',
    total: 'Отправлено отзывов', answered: 'Ответов', median: 'Медиана', distribution: 'Распределение оценок', score: 'Оценка', count: 'Количество',
    responses: 'Отзывы', notes: 'Сообщения о страницах', all: 'Все страницы', page: 'Фильтр по странице', search: 'Найти страницу',
    empty: 'Отзывов пока нет.', emptyNotes: 'Для этой страницы сообщений пока нет.', ai: 'Комментарий об ИИ',
    noScores: 'В этом отзыве нет оценок.', source: 'Источник', language: 'Язык', release: 'Версия',
    sources: { footer: 'Футер', prompt: 'Приглашение', direct: 'Прямая ссылка' },
    player: 'Персонаж', noPlayer: 'Персонаж не привязан', country: 'Страна', unknownCountry: 'Страна неизвестна', device: 'Устройство',
    devices: { desktop: 'Компьютер', mobile: 'Телефон', tablet: 'Планшет', unknown: 'Неизвестно' },
    previous: 'Предыдущая партия', next: 'Следующая партия', batch: 'Партия', shown: 'Показано', messages: 'Сообщений',
    separate: 'Каждое сообщение о странице — отдельный отзыв. Оценки относятся ко всей отправке.',
  },
});
