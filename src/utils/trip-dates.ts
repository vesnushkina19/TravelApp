const MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** '2027-05-03' → '3 мая' (с днём недели — '3 мая, пн'). */
export function formatDay(iso: string, withWeekday = false) {
  const d = new Date(`${iso}T00:00:00`);
  const base = `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}`;
  return withWeekday ? `${base}, ${WEEKDAYS[d.getDay()]}` : base;
}
