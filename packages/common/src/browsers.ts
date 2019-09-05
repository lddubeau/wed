/**
 * Browser detection. Extremely ad hoc and meant for wed's internal purposes
 * only.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

//
// Yes, testing features rather versions or specific browsers is the way to go,
// generally speaking. However, when we are working around bugs in *specific
// versions* of *specific browsers*, feature testing is mostly
// useless. So... here we are.
//
// Note that symbols are introduced for purely ad hoc reasons. If we need to
// test for a specific combination somewhere in wed's code base, we have a
// flag. If we don't need the test, we don't have a flag.
//
// Also this code only satisfies the interests of wed. Don't take the tests here
// as gospel. If *you* need to test for some combinations that wed does not care
// about, you may find that the code here gives incorrect results relative to
// *your* goals. This code is meant to give correct results only relative to
// what wed cares about. (Salient example: wed is not designed (at this time) to
// run in tablets or phones. So the tests below don't take into account what
// might happen when running in a tablet or phone.)
//

const agent = navigator.userAgent;

/**
 * True if the browser is Edge.
 */
export const EDGE = agent.indexOf(" Edge/") !== -1;

/**
 * True if the browser is Chrome.
 */
// We have to test exclude Edge from the possibilities because Edge lies about
// its identity.
export const CHROME = !EDGE && agent.indexOf(" Chrome/") !== -1;

/**
 * True if the browser is Firefox.
 */
export const FIREFOX = agent.indexOf(" Firefox/") !== -1;

/**
 * True if the browser is Gecko-based.
 */
export const GECKO = agent.indexOf(" Gecko/") !== -1;

/**
 * True if running on a OS X system.
 */
export const OSX = navigator.platform.lastIndexOf("Mac", 0) === 0;

/**
 * True if running on Windows.
 */
// We don't care about old platforms or oddball Windows platforms.
export const WINDOWS = navigator.platform === "Win32";

//  LocalWords:  MPL wed's
