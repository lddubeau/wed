# pylint: disable=E0611
from nose.tools import assert_equal, assert_is_not_none


step_matcher("re")


@then(ur"^the selection is wrapped in a new element.?$")
def step_impl(context):
    util = context.util

    item = context.clicked_context_menu_item
    if not item.startswith("Wrap in "):
        raise ValueError("unexpected item value: " + item)

    element_name = item[len("Wrap in "):]
    parent = context.selection_parent

    child = util.wait(lambda *_:
                      parent.find_element_by_class_name(element_name))

    assert_equal(util.get_text_excluding_children(child),
                 context.expected_selection)


@then(ur"^a new element is inserted before the selected element.?$")
def step_impl(context):
    for_element = context.context_menu_for
    info = context.context_menu_pre_transformation_info
    assert_is_not_none(for_element)
    preceding = for_element.find_elements_by_xpath("preceding-sibling::*")
    following = for_element.find_elements_by_xpath("following-sibling::*")
    assert_equal(len(info["preceding"]) + 1, len(preceding),
                 "items before the selected element")
    assert_equal(len(info["following"]), len(following),
                 "items after the selected element")


@then(ur"^a new element is inserted after the selected element.?$")
def step_impl(context):
    for_element = context.context_menu_for
    info = context.context_menu_pre_transformation_info
    assert_is_not_none(for_element)
    preceding = for_element.find_elements_by_xpath("preceding-sibling::*")
    following = for_element.find_elements_by_xpath("following-sibling::*")
    assert_equal(len(info["preceding"]), len(preceding),
                 "items before the selected element")
    assert_equal(len(info["following"]) + 1, len(following),
                 "items after the selected element")


@then(ur"^a new (?P<what>.*?) is created inside the element")
def step_impl(context, what):
    util = context.util
    driver = context.driver
    for_element = context.context_menu_for

    info = context.context_menu_pre_transformation_info

    def cond(*_):
        children = driver.execute_script("""
        return jQuery(arguments[0]).children("._real").toArray();
        """, for_element)
        return len(info["children"]) + 1 == len(children)

    util.wait(cond)


@then(ur"^the teiHeader has been filled as much as possible$")
def step_impl(context):
    util = context.util
    driver = context.driver

    def cond(*_):
        test, _ = driver.execute_script("""
        var $children = jQuery("._real.teiHeader>._real");
        if (!($children.length === 1 && $children.eq(0).is(".fileDesc")))
            return [false, "teiHeader contents"];

        $children = jQuery("._real.fileDesc>._real");
        if (!($children.length === 3 && $children.eq(0).is(".titleStmt") &&
              $children.eq(1).is(".publicationStmt") &&
              $children.eq(2).is(".sourceDesc")))
            return [false, "fileDesc contents"];


        $children = jQuery("._real.titleStmt>._real");
        if (!($children.length === 1 && $children.eq(0).is(".title")))
            return [false, "titleStmt contents"];


        $children = jQuery("._real.title>._real, " +
                           "._real.publicationStmt>._real, " +
                           "._real.sourceDesc>._real");
        if ($children.length !== 0)
            return [false, "contents of end elements"];

        return [true, ""];
        """)
        return test

    util.wait(cond)


@then(ur"^the teiHeader has not been filled$")
def step_impl(context):
    util = context.util
    driver = context.driver

    def cond(*_):
        test, _ = driver.execute_script("""
        var $children = jQuery("._real.teiHeader>._real");
        if ($children.length !== 0)
            return [false, "contents of teiHeader"];

        return [true, ""];
        """)
        return test

    util.wait(cond)
