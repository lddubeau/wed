/**
 * Conversion from XML to HTML.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
define(["require", "exports", "module", "./domtypeguards", "./util"], function (require, exports, module, domtypeguards_1, util_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    // tslint:disable-next-line: no-http-string
    var XML1_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
    // tslint:disable-next-line: no-http-string
    var XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";
    function normalizeNS(ns) {
        if (ns === null) {
            ns = "";
        }
        return ns;
    }
    /**
     * Convert an XML tree or subtree into an HTML tree suitable to be inserted into
     * the GUI tree.
     *
     * XML Elements are converted to ``div`` elements with a ``class`` that has:
     *
     * - for first class the tag name (qualified name in XML parlance) of the
     *    element,
     *
     * - for second class the ``_local_<local name>`` where ``<local name>`` is the
     *   local name of the element,
     *
     * - for third class ``_xmlns_<namespace uri>`` where ``namespace uri`` is
     *   the URI of the namespace of the XML element,
     *
     * - for fourth class ``_real``.
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
    function toHTMLTree(doc, node) {
        var ret;
        if (domtypeguards_1.isElement(node)) {
            ret = doc.createElement("div");
            ret.className = node.tagName + " _local_" + node.localName + " _xmlns_" + normalizeNS(node.namespaceURI) + " _real";
            //
            // We encode attributes here in the following way:
            //
            // 1. A sequence of three dashes or more gains a dash. So three dashes
            // becomes 4, 4 becomes 5, etc.
            //
            // 2. A colon (which should be present only to mark the prefix) becomes a
            // sequence of three dashes.
            //
            for (var i = 0; i < node.attributes.length; ++i) {
                var attr = node.attributes[i];
                ret.setAttribute(util_1.encodeAttrName(attr.name), attr.value);
                var ns = attr.namespaceURI;
                // We do not output this attribute if the namespace is for XML v1 or
                // the xmlns namespace.
                if (ns !== null && ns !== XML1_NAMESPACE && ns !== XMLNS_NAMESPACE) {
                    ret.setAttribute(util_1.encodeAttrName(attr.name, "ns"), ns);
                }
            }
            var child = node.firstChild;
            while (child !== null) {
                ret.appendChild(toHTMLTree(doc, child));
                child = child.nextSibling;
            }
        }
        else if (domtypeguards_1.isText(node)) {
            ret = document.createTextNode(node.data);
        }
        else {
            throw new Error("unhandled node type: " + node.nodeType);
        }
        return ret;
    }
    exports.toHTMLTree = toHTMLTree;
});
//  LocalWords:  MPL subtree tagName localName xmlns normalizeNS namespaceURI
//  LocalWords:  ns nodeType

//# sourceMappingURL=convert.js.map
