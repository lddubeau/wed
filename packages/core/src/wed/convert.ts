/**
 * Conversion from XML to HTML.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { encodeAttrName } from "./util";

// tslint:disable-next-line: no-http-string
const XML1_NAMESPACE: string = "http://www.w3.org/XML/1998/namespace";

// tslint:disable-next-line: no-http-string
const XMLNS_NAMESPACE: string = "http://www.w3.org/2000/xmlns/";

const TYPE_TO_KIND = {
  __proto__: null,
  [Node.COMMENT_NODE]: "comment",
  [Node.DOCUMENT_TYPE_NODE]: "doctype",
};

function normalizeNS(ns: string | null): string {
  if (ns === null) {
    ns = "";
  }

  return ns;
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
      const kind = TYPE_TO_KIND[node.nodeType];
      if (kind === undefined) {
        throw new Error(`unknown node type: ${node.nodeType}`);
      }
      ret.className = `_real _${kind}`;
      ret.textContent = node.textContent;
      break;
    case Node.PROCESSING_INSTRUCTION_NODE:
      const pi = node as ProcessingInstruction;
      ret = document.createElement("div");
      ret.className = "_real _pi";
      ret.textContent = `${pi.target} ${pi.data}`;
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
