import { IToolbox } from '../core/toolbox'
import { open, chromeOpn } from '../toolbox/open-tools'

/**
 * Extensions to print to the console.
 *
 * @param toolbox The running toolbox.
 */
export default function attach(toolbox: IToolbox): void {
  // attach the feature set
  toolbox.open = open
  toolbox.chromeOpn = chromeOpn
}
