// Week = Thursday to Wednesday (per business rule)

function pad(n: number) { return String(n).padStart(2, '0') }

/** Returns the Thursday on or before the given date (week start). */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
  const daysBack = (d.getDay() - 4 + 7) % 7
  d.setDate(d.getDate() - daysBack)
  return d
}

/** Returns the Wednesday that is 6 days after weekStart. */
export function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + 6)
  return d
}

/** Format date as MM/DD */
function fmd(date: Date) {
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}`
}

/** Format week as "MM/DD - MM/DD" */
export function formatWeekRange(weekStart: Date): string {
  return `${fmd(weekStart)} - ${fmd(getWeekEnd(weekStart))}`
}

/** YYYY-MM-DD string for a Date */
export function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Parse a YYYY-MM-DD string to a local Date */
export function fromDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** All Thursdays (week starts) whose year === the given year */
export function getWeeksForYear(year: number): Date[] {
  const weeks: Date[] = []
  // Find first Thursday of the year
  const d = new Date(year, 0, 1)
  d.setHours(0, 0, 0, 0)
  const daysToThu = (4 - d.getDay() + 7) % 7
  d.setDate(d.getDate() + daysToThu)
  while (d.getFullYear() === year) {
    weeks.push(new Date(d))
    d.setDate(d.getDate() + 7)
  }
  return weeks
}

/** Current week start (Taiwan time approximation using local clock) */
export function getCurrentWeekStart(): Date {
  return getWeekStart(new Date())
}

export function getAvailableYears(): number[] {
  const y = new Date().getFullYear()
  return [y - 1, y, y + 1]
}
