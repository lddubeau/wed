/**
 * Conversion from XML to HTML.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { diffChars } from "diff";

// tslint:disable-next-line: no-http-string
const XML1_NAMESPACE: string = "http://www.w3.org/XML/1998/namespace";

// tslint:disable-next-line: no-http-string
const XMLNS_NAMESPACE: string = "http://www.w3.org/2000/xmlns/";

function normalizeNS(ns: string | null): string {
  if (ns === null) {
    ns = "";
  }

  return ns;
}

/**
 * Convert a string to a sequence of char codes. Each char code will be preceded
 * by the character ``x``. The char codes are converted to hexadecimal.
 *
 * This is meant to be used by wed's internal code.
 *
 * @private
 *
 * @param str The string to encode.
 *
 * @returns The encoded string.
 */
export function stringToCodeSequence(str: string): string {
  let encoded = "";
  for (const char of str) {
    encoded += `x${char.charCodeAt(0).toString(16)}`;
  }
  return encoded;
}

const ENCODED_RE = /^(?:x[a-f0-9]+)+$/;

/**
 * Convert a code sequence created with [[stringToCodeSequence]] to a string.
 *
 * This is meant to be used by wed's internal code.
 *
 * @private
 *
 * @param str The sequence to decode.
 *
 * @returns The decoded string.
 */
export function codeSequenceToString(str: string): string {
  if (!ENCODED_RE.test(str)) {
    throw new Error("badly encoded string");
  }

  let decoded = "";
  // We slice to skip the initial x, and not get a first part which is "".
  for (const code of str.slice(1).split("x")) {
    decoded += String.fromCharCode(parseInt(code, 16));
  }
  return decoded;
}

/**
 * Encode the difference between an original string, and a modified string. This
 * is a specialized function designed to handle the difference between the name
 * we want to set for an attribute, and the name that HTML actually records.
 *
 * This function records the difference as a series of steps to recover the
 * original string:
 *
 * - ``g[number]`` means take ``[number]`` characters from the modified string
 *   as they are.
 *
 * - ``m[number]`` means remove ``[number]`` characters from the modified
 *   string.
 *
 * - ``p[codes]`` means add the codes ``[codes]`` to the modified string.
 *
 * - ``u[number]`` means convert ``[number]`` characters from the modified
 *   string to uppercase.
 *
 * This is meant to be used by wed's internal code.
 *
 * @private
 *
 * @param orig The original.
 *
 * @param modified The modified string.
 *
 * @returns The difference, encoded as a string.
 */
export function encodeDiff(orig: string, modified: string): string {
  let diff = "";
  if (orig !== modified) {
    const results = diffChars(modified, orig);
    const last = results[results.length - 1];
    for (let ix = 0; ix < results.length; ++ix) {
      const result = results[ix];
      if (result.added === true) {
        diff += `p${stringToCodeSequence(result.value)}`;
      }
      else if (result.removed ===  true) {
        const next = results[ix + 1];
        if ((next !== undefined && next.added === true) &&
            (result.value.toUpperCase() === next.value)) {
          diff += `u${result.value.length}`;
          ix++;
        }
        else {
          diff += `m${result.value.length}`;
        }
      }
      else {
        // We don't output this if it is last, as it is implied.
        if (result !== last) {
          diff += `g${result.value.length}`;
        }
      }
    }
  }

  return diff;
}

const OP_RE =  /^(?:p([xa-f0-9]+))|(?:[gmu](\d+))/;

/**
 * Decode the diff produced with [[encodeDiff]].
 *
 * This is meant to be used by wed's internal code.
 *
 * @private
 *
 * @param name The name, after encoding.
 *
 * @param diff The diff.
 *
 * @returns The decoded attribute name.
 */
export function decodeDiff(name: string, diff: string): string {
  if (diff === "") {
    return name;
  }

  let nameIndex = 0;
  let result = "";
  while (diff.length > 0) {
    const match = diff.match(OP_RE);
    if (match !== null) {
      diff = diff.slice(match[0].length);
      const op = match[0][0];
      switch (op) {
      case "g":
      case "m":
      case "u":
        const length = parseInt(match[2]);
        switch (op) {
        case "g":
          result += name.slice(nameIndex, nameIndex + length);
          break;
        case "u":
          result += name.slice(nameIndex, nameIndex + length).toUpperCase();
          break;
        case "m":
          break;
        default:
          throw new Error(`internal error: unexpected op ${op}`);
        }
        nameIndex += length;
        break;
      case "p":
        result += codeSequenceToString(match[1]);
        break;
      default:
        throw new Error(`unexpected operator ${op}`);
      }
    }

    // Nothing matched
    if (match === null) {
      throw new Error(`cannot parse diff: ${diff}`);
    }
  }

  // It is implied that the rest of the name is added.
  result += name.slice(nameIndex);

  return result;
}

/**
 * Transforms an attribute name from wed's data tree to the original attribute
 * name before the data was transformed for use with wed. This reverses the
 * transformation done with [[encodeAttrName]].
 *
 * @param encoded The encoded name.
 *
 * @returns A structure containing the decoded name the optional qualifier.
 */
export function decodeAttrName(encoded: string):
{ name: string; qualifier: string | undefined } {
  const match = /^data-wed-(.+)-([^-]*?)$/.exec(encoded);
  if (match === null) {
    throw new Error("malformed name");
  }

  // tslint:disable-next-line:prefer-const
  let [, name, diff] = match;

  let qualifier: string | undefined;
  // qualifier
  if (name[0] === "-") {
    const parts = /^-(.+?)-(.+)$/.exec(name);
    if (parts === null) {
      throw new Error("malformed name");
    }
    [, qualifier, name] = parts;
  }

  name = name.replace(/---/, ":").replace(/---(-+)/g, "--$1");

  if (diff !== "") {
    name = decodeDiff(name, diff);
  }

  return { name, qualifier };
}

/**
 * Transforms an attribute name from its unencoded form in the original XML data
 * (before transformation for use with wed) to its encoded name.
 *
 * The first thing this algorithm does is compute a difference between the
 * original XML name and how HTML will record it. The issue here is that XML
 * allows more characters in a name than what HTML allows and doing
 * ``setAttribute(name, value)`` will silently convert ``name`` to something
 * HTML likes. The issue most frequently encountered is that uppercase letters
 * are encoded as lowercase. This is especially vexing seeing as XML allows the
 * attribute names ``x`` and ``X`` to exist as different attributes, whereas
 * HTML does not. For HTML ``x`` and ``X`` are the same attribute. This function
 * records any differences between the original name and the way HTML records it
 * with a diff string that is appended to the final name after a dash. If
 * nothing appears after the final dash, then the HTML name and the XML name are
 * the same.
 *
 * A sequence of three dashes or more is converted by adding another dash. (So
 * sequences of single dash, or a pair of dashes remain unchanged. But all
 * sequences of 3 dashes or more gets an additional dash.)
 *
 * A colon (``:``) is converted to three dashes ``---``.
 *
 * After transformation above the name is prepended with ``data-wed-`` and it is
 * appended with the diff described above.
 *
 * Examples:
 *
 * - ``foo:bar`` becomes ``data-wed-foo---bar-``. Note how the diff is
 *    empty, because ``foo:bar`` can be represented as-is in HTML.
 *
 * - ``MOO:aBc---def`` becomes ``data-wed-moo---abc----def-u3g2u1``. Note the
 *   diff suffix, which allows restoring the orignal case.
 *
 * When ``qualifier`` is used, the qualifier is added just after ``data-wed-``
 * and is prepended and appended with a dash. So ``foo:bar`` with the qualifier
 * ``ns`` would become ``data-wed--ns-foo---bar-``. The addition of a dash in
 * front of the qualifier makes it impossible to confuse an encoding that has a
 * qualifier from one that does not, as XML attribute names are not allowed to
 * start with a dash.
 *
 * @param name The unencoded name (i.e. the attribute name as it is in XML).
 *
 * @param qualifier An optional qualifier.
 *
 * @returns The encoded name.
 */
export function encodeAttrName(name: string, qualifier?: string): string {
  const el = document.createElement("div");
  // We havve to add the "data-" prefix to guard against some problems. IE11,
  // for instance, will choke if we set an attribute with the name "style". It
  // simply does not generally allow ``setAttribute("style", ...)``. Adding the
  // prefix, works around the problem. And we know "data-" will not be mangled,
  // so we can just strip it afterwards.
  el.setAttribute(`data-${name}`, "");
  // Slice it to remove the "data-" prefix.
  const attrName = el.attributes[0].name.slice(5);
  const sanitized = attrName.replace(/--(-+)/g, "---$1").replace(/:/, "---");
  qualifier = qualifier === undefined ? "" : `-${qualifier}-`;
  return `data-wed-${qualifier}${sanitized}-${encodeDiff(name, attrName)}`;
}

export function makeElementClass(tagName: string, localName: string,
                                 namespaceURI: string | null): string {
  return `${tagName} _name_${tagName} _local_${localName} \
_xmlns_${normalizeNS(namespaceURI)} _real _el`;
}

/**
 * Convert an XML tree or subtree into an HTML tree suitable to be inserted into
 * the GUI tree.
 *
 * XML Elements are converted to ``div`` elements with a ``class`` that has:
 *
 * - for first class the tag name (qualified name in XML parlance) of the
 *   element,
 *
 * - for second class ``_name_<tag name>`` where ``<tag name>`` is the tag name
 *   (prefix colon local name),
 *
 * - for third class ``_local_<local name>`` where ``<local name>`` is the local
 *   name of the element,
 *
 * - for fourth class ``_xmlns_<namespace uri>`` where ``namespace uri`` is the
 *   URI of the namespace of the XML element,
 *
 * - for fifth class ``_real``.
 *
 * - for sixth class ``_el``.
 *
 * Other XML structures are converted to ``<div class="_real _[type]">`` with
 * the content of ``div`` set to the content of the corresponding XML
 * structure. The ``[type]`` is:
 *
 * - ``comment`` for comments,
 *
 * - ``cdata`` for cdata,
 *
 * - ``pi`` for processing instructions,
 *
 * DEPRECATION NOTICE: the first class is deprecated as of version 5.0.0
 *
 * The attributes of the XML element appear on the HTML element with the name
 * ``data-wed-<attribute name>``, where ``attribute name`` is converted by
 * [[encodeAttrName]]. This attribute has for value the original
 * value in the XML. A second attribute ``data-wed--ns-<attribute name>``
 * contains the namespace URI of the attribute. If the attribute was not in a
 * namespace, then ``data-wed--ns-<attribute name>`` is omitted.
 *
 * @param doc The HTML document in which we are going to use the generated
 * tree.
 *
 * @param node The root of the XML tree to convert.
 *
 * @returns The root of the newly created HTML tree.
 */
export function toHTMLTree(doc: Document, node: Node): Node {
  let ret;
  switch (node.nodeType) {
    case Node.ELEMENT_NODE:
      ret = doc.createElement("div");

      const el = node as Element;
      ret.className = makeElementClass(el.tagName, el.localName,
                                       el.namespaceURI);
      //
      // We encode attributes here in the following way:
      //
      // 1. A sequence of three dashes or more gains a dash. So three dashes
      // becomes 4, 4 becomes 5, etc.
      //
      // 2. A colon (which should be present only to mark the prefix) becomes a
      // sequence of three dashes.
      //
      for (let i = 0; i < el.attributes.length; ++i) {
        const attr = el.attributes[i];

        ret.setAttribute(encodeAttrName(attr.name), attr.value);
        const ns = attr.namespaceURI;

        // We do not output this attribute if the namespace is for XML v1 or
        // the xmlns namespace.
        if (ns !== null && ns !== XML1_NAMESPACE && ns !== XMLNS_NAMESPACE) {
          ret.setAttribute(encodeAttrName(attr.name, "ns"), ns);
        }
      }

      let child: Node | null = node.firstChild;
      while (child !== null) {
        ret.appendChild(toHTMLTree(doc, child));
        child = child.nextSibling;
      }
      break;
    case Node.COMMENT_NODE:
      ret = document.createElement("div");
      ret.className = `_real _comment`;
      ret.textContent = node.textContent;
      break;
    case Node.PROCESSING_INSTRUCTION_NODE:
      ret = document.createElement("div");
      ret.className = "_real _pi";
      ret.textContent = (node as CharacterData).data;
      break;
    case Node.TEXT_NODE:
      const text = node as Text;
      ret = document.createTextNode(text.data);
      break;
    default:
      throw new Error(`unhandled node type: ${node.nodeType}`);
  }

  return ret;
}

export function _sanitizeXML(node: Node): void {
  switch (node.nodeType) {
    case Node.ELEMENT_NODE:
    case Node.DOCUMENT_NODE:
    case Node.DOCUMENT_FRAGMENT_NODE:
      let child: Node | null = node.firstChild;
      while (child !== null) {
        const next = child.nextSibling;
        _sanitizeXML(child);
        child = next;
      }
      break;
    case Node.CDATA_SECTION_NODE:
      const text = document.createTextNode((node as CDATASection).data);
      node.parentNode!.replaceChild(text, node);
      break;
    default:
      // Other nodes are left as they are.
  }
}

/**
 * "Sanitize" an XML tree. Wed does not support full roundtrippability so some
 * XML constructs are converted to what wed can use. In particular CData
 * sections become plain text.
 */
export function sanitizeXML(node: Node): void {
  _sanitizeXML(node);

  // We normalize once, after everything is done so that CData that were
  // adjacent to Text and converted to Text are merged with the adjacent Text,
  // or removed if they were empty.
  node.normalize();
}

//  LocalWords:  MPL subtree tagName localName xmlns normalizeNS namespaceURI
//  LocalWords:  ns nodeType
