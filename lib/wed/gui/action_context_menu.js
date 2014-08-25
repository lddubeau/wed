/**
 * @module gui/action_context_menu
 * @desc Context menus meant to hold actions.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2014 Mangalam Research Center for Buddhist Languages
 */

define(/** @lends module:gui/action_context_menu */ function (require, exports,
                                                              module) {
'use strict';

var context_menu = require("./context_menu");
var $ = require("jquery");
var icon = require("./icon");
var oop = require("../oop");
var log = require("../log");
var key_constants = require("../key_constants");
var key = require("../key");
var browsers = require("../browsers");

var Base = context_menu.ContextMenu;
var KINDS = ["add", "delete", "wrap", "unwrap"];
// ``null`` is "all kinds", and ``undefined`` is "other kinds".
var KIND_FILTERS = [null, "add", "delete", "wrap", "unwrap", undefined];
// Sort order.
var KIND_ORDER = [undefined].concat(KINDS);


/**
 * @classdesc A context menu for displaying actions. This class is
 * designed to know how to sort {@link module:action~Action Action}
 * objects and {@link module:transformation~Transformation
 * Transformation} objects and how to filter them. Even though the
 * names used here suggest that ``Action`` objects are the focus of
 * this class, the fact is that it is really performing its work on
 * ``Transformation`` objects. It does accept ``Action`` as a kind of
 * lame ``Transformation``. So the following description will focus on
 * ``Transformation`` objects rather than ``Action`` objects.
 *
 * Sorting is performed first by the ``kind`` of the
 * ``Transformation`` and then by the text associated with the
 * ``Transformation``. The kinds, in order, are:
 *
 * - other kinds than those listed below,
 *
 * - undefined ``kind``,
 *
 * - ``"add"``,
 *
 * - ``"delete"``,
 *
 * - ``"wrap"``,
 *
 * - ``"unwrap"``,
 *
 * The text associated with the transformation is the text value of
 * the DOM ``Element`` object stored in the ``item`` field of the
 * object given in the ``items`` array passed to the
 * constructor. ``Actions`` are considered to have an undefined ``kind``.
 *
 * Filtering is performed by ``kind`` and on the text of the **element
 * name** associated with a transformation. This class presents to the
 * user a row of buttons that represent graphically the possible
 * filters. Clicking on a button will reduce the list of displayed
 * items only to those elements that correspond to the ``kind`` to
 * which the button corresponds.
 *
 * Typing text (e.g. "foo") will narrow the list of items to the text
 * that the user typed. Let's suppose that ``item`` is successively
 * taking the values in the ``items`` array. The filtering algorithm
 * first checks whether there is a ``item.data.element_name``
 * field. If there is, the match is performed against this field. If
 * not, the match is performed against the text of ``item.item``.
 *
 * If the text typed begins with a caret (^), the text will be
 * interpreted as a regular expression.
 *
 * Typing ESCAPE will reset filtering.
 *
 * When no option is focused, typing ENTER will select the first
 * option of the menu.
 *
 * @extends {module:gui/context_menu~ContextMenu}
 * @constructor
 * @param {Document} document The DOM document for which to make this
 * context menu.
 * @param {integer} x Position of the menu. The context menu may
 * ignore this position if the menu would appear off-screen.
 * @param {integer} y Position of the menu.
 * @param {Array.<{action: module:action~Action, item: Element, data: Object}>}
 * items An array of action information in the form of anonymous objects. It
 * is valid to have some items in the array be of the form
 * ``{action: null, item: some_element, data: null}`` to insert arbitrary
 * menu items.
 * @param {Function} dismiss_callback Function to call when the menu
 * is dismissed.
 */
function ContextMenu(document, x, y, items, dismiss_callback) {
    // Sort the items once and for all.
    items.sort(function (a, b) {
        var a_kind = a.action && a.action.kind;
        var b_kind = b.action && b.action.kind;

        if (a_kind !== b_kind) {
            var a_order = KIND_ORDER.indexOf(a_kind);
            var b_order = KIND_ORDER.indexOf(b_kind);

            return a_order - b_order;
        }

        var a_text = a.item.textContent;
        var b_text = b.item.textContent;
        if (a_text === b_text)
            return 0;

        if (a_text < b_text)
            return -1;

        return 1;
    });

    this._action_items = items;
    this._action_kind_filter = null;
    this._action_text_filter = "";

    // Create the filtering GUI...

    // <li><div><button>... allows us to have this button group
    // inserted in the menu and yet be ignored by Bootstrap's
    // Dropdown class.
    var li = document.createElement("li");
    li.className = "wed-menu-filter";
    var group = document.createElement("div");
    group.className = "btn-group btn-group-xs";
    for(var i = 0, limit = KIND_FILTERS.length; i < limit; ++i) {
        var kind = KIND_FILTERS[i];
        var child = document.createElement("button");
        child.className = 'btn btn-default';
        var title;
        if (kind) {
            child.innerHTML = icon.makeHTML(kind);
            title = 'Show only ' + kind + ' operations.';
        }
        else if (kind === null) {
            child.innerHTML = icon.makeHTML("any");
            title = 'Show all operations.';
        }
        else {
            child.innerHTML = "other";
            title = 'Show operations not covered by other filter buttons.';
        }
        $(child).tooltip({
            title: title,
            // If we don't set it to be on the body, then the tooltip
            // will be clipped by the dropdown. However, we then run
            // into the problem that when the dropdown menu is
            // removed, the tooltip may remain displayed.
            container: 'body',
            placement: 'auto top'
        });
        $(child).on("click", makeHandler(this, kind));
        group.appendChild(child);
    }

    // Prevent clicks in the group from closing the context menu.
    $(li).on("click", false);
    li.appendChild(group);

    var text_input = document.createElement("input");
    var text_div = document.createElement("div");
    text_div.appendChild(text_input);
    li.appendChild(text_div);

    var $text_input = $(text_input);
    $text_input.on("input", this._inputChangeHandler.bind(this));
    $text_input.on("keydown", this._inputKeydownHandler.bind(this));
    $text_input.tooltip({
        title: 'Type text here to filter the menu items based by text.',
        container: 'body',
        placement: 'auto top',
        trigger: 'hover'
    });
    this._action_filter_item = li;
    this._action_filter_input = text_input;

    // this._$menu is nonexistent at this stage, so we cannot yet add
    // this._action_filter_item to the menu.
    //
    // Call our superclass' constructor first...
    //
    context_menu.ContextMenu.call(this, document, x, y, [], dismiss_callback);

    // For some reason IE is not happy if we perform the focus right away.
    if (!browsers.MSIE)
        text_input.focus();
    else
        setTimeout(function () {
            text_input.focus();
        }, 50);
    var menu = this._menu;
    var $menu = $(menu);
    $menu.parent().on("hidden.bs.dropdown",
                      log.wrap(function () {
                          // Manually destroy the tooltips so that
                          // they are not left behind.
                          $(text_input).tooltip('destroy');
                          $(group.children).tooltip('destroy');
                      }));
    $menu.on("keydown", this._actionKeydownHandler.bind(this));
    $menu.on("keypress", this._actionKeypressHandler.bind(this));
}

oop.inherit(ContextMenu, Base);

function makeHandler(me, kind) {
    return log.wrap(function (ev) {
        me._action_kind_filter = kind;
        me._render();
    });
}

var ITEM_SELECTOR = "li:not(.divider):visible a";

ContextMenu.prototype._actionKeydownHandler = log.wrap(function (ev) {
    if (key_constants.ESCAPE.matchesEvent(ev)) {
        if (this._action_kind_filter !== null ||
            this._action_text_filter) {
            this._action_kind_filter = null;
            this._action_text_filter = "";
            this._action_filter_input.value = "";
            this._render();
            ev.stopPropagation();
            ev.preventDefault();
            return false;
        }
    }
    return true;
});

var plus = key.makeKey("+");
var minus = key.makeKey("-");
var period = key.makeKey(".");
var comma = key.makeKey(",");
var question = key.makeKey("?");

var KEY_TO_FILTER = [
    {key: plus, filter: 'add'},
    {key: minus, filter: 'delete'},
    {key: comma, filter: 'wrap'},
    {key: period, filter: 'unwrap'},
    {key: question, filter: undefined }
];

ContextMenu.prototype._actionKeypressHandler = log.wrap(function (ev) {
    if (this._action_kind_filter === null &&
        !this._action_text_filter) {
        for(var i = 0, pair; (pair = KEY_TO_FILTER[i]) !== undefined; ++i) {
            var key = pair.key;
            if (key.matchesEvent(ev)) {
                this._action_kind_filter = pair.filter;
                this._render();
                ev.stopPropagation();
                ev.preventDefault();
                return false;
            }
        }
    }

    return true;
});

ContextMenu.prototype._inputChangeHandler = log.wrap(function (ev) {
    this._action_text_filter = ev.target.value;
    this._render();
});

ContextMenu.prototype._inputKeydownHandler = log.wrap(function (ev) {
    if (key_constants.ENTER.matchesEvent(ev)) {
        this._$menu.find(ITEM_SELECTOR).first().focus().click();
        ev.stopPropagation();
        ev.preventDefault();
        return false;
    }
    return true;
});

ContextMenu.prototype._render = function () {
    var menu = this._menu;
    var action_filter_item = this._action_filter_item;
    var action_kind_filter = this._action_kind_filter;
    // On IE 10, we don't want to remove and then add back
    // this._action_filter_item on each render because that makes
    // this._action_filter_input lose the focus. Yes, even with the
    // call at the end of _render, IE 10 inexplicably makes the field
    // lose focus **later**.
    while(menu.lastChild && menu.lastChild !== action_filter_item)
        menu.removeChild(menu.lastChild);

    var children = action_filter_item.firstElementChild.children;
    for(var i = 0, limit = KIND_FILTERS.length; i < limit; ++i) {
        var kind = KIND_FILTERS[i];
        var cl = children[i].classList;
        var method = (action_kind_filter === kind) ? cl.add : cl.remove;
        method.call(cl, "active");
    }

    if (!action_filter_item.parentNode)
        menu.appendChild(action_filter_item);
    var items = this._computeActionItemsToDisplay(this._action_items);
    Base.prototype._render.call(this, items);
    this._action_filter_input.focus();
};

ContextMenu.prototype._computeActionItemsToDisplay = function (items) {
    var kind_filter = this._action_kind_filter;
    var text_filter = this._action_text_filter;

    var kindMatch;
    switch(kind_filter) {
    case null:
        kindMatch = function kindMatchAll() { return true; };
        break;
    case undefined:
        kindMatch = function kindMatchNoKind(item) {
            return !item.action || KINDS.indexOf(item.action.kind) === -1;
        };
        break;
    default:
        kindMatch = function kindMatchSome(item) {
            return item.action && item.action.kind === kind_filter;
        };
    };

    var textMatch;
        if (text_filter) {
            if (text_filter[0] === "^") {
                var text_filter_re = RegExp(text_filter);
                textMatch = function textMatchSomeRe(item) {
                    var text = (item.data && item.data.element_name)?
                            item.data.element_name : item.item.textContent;
                    return text_filter_re.test(text);
                };
            }
            else
                textMatch = function textMatchSome(item) {
                    var text = (item.data && item.data.element_name)?
                            item.data.element_name : item.item.textContent;
                    return text.indexOf(text_filter) !== -1;
                };
        }
    else
        textMatch = function textMatchAll() { return true; };

    var ret = [];
    for(var i = 0, item; (item = items[i]) !== undefined; ++i) {
        if (kindMatch(item) && textMatch(item))
            ret.push(item.item);
    }

    return ret;
};

exports.ContextMenu = ContextMenu;

});