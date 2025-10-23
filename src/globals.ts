import dayjs from 'dayjs'
import packageJson from '../package.json' // adjust relative path as needed

console.log(packageJson.version)
console.log(packageJson)

const __VERSION__ = `${packageJson.version}-${dayjs().format('YYYYMMDD-HH:mm')}`

export default {
  __VERSION__,
  // packageJson,
}
