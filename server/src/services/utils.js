export const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
export const pick = arr => arr[Math.floor(Math.random() * arr.length)]
export const pickN = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n)
