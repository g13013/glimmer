import { TestEnvironment, TestDynamicScope, normalizeInnerHTML, getTextContent, equalTokens } from "glimmer-test-helpers";
import { Template, Simple, AttributeManager } from '../index';
import { UpdatableReference } from 'glimmer-object-reference';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';
const XHTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';

let env: TestEnvironment, root: HTMLElement;

function compile(template: string) {
  let out = env.compile(template);
  return out;
}

function compilesTo(html: string, expected: string=html, context: any={}) {
  let template = compile(html);
  root = rootElement();
  QUnit['ok'](true, `template: ${html}`);
  render(template, context);
  equalTokens(root, expected);
}

function rootElement(): HTMLDivElement {
  return env.getDOM().createElement('div') as HTMLDivElement;
}

function commonSetup(assert: Assert, customEnv = new TestEnvironment()) {
  env = customEnv; // TODO: Support SimpleDOM
  root = rootElement();
}

function render<T>(template: Template<T>, self: any) {
  let result;
  env.begin();
  result = template.render(new UpdatableReference(self), root, new TestDynamicScope());
  env.commit();
  return result;
}

function module(name: string) {
  return QUnit.module(name, {
    beforeEach: commonSetup
  });
}

module("[glimmer-runtime] Initial render - Simple HTML, inline expressions");

QUnit.test("HTML text content", assert => {
  let template = compile("content");
  render(template, {});

  equalTokens(root, "content");
});

QUnit.test("HTML tags", assert => {
  let template = compile("<h1>hello!</h1><div>content</div>");
  render(template, {});

  equalTokens(root, "<h1>hello!</h1><div>content</div>");
});

QUnit.test("HTML tags re-rendered", assert => {
  let template = compile("<h1>hello!</h1><div>content</div>");
  let result = render(template, {});

  let oldFirstChild = root.firstChild;

  env.begin();
  result.rerender();
  env.commit();

  assert.strictEqual(root.firstChild, oldFirstChild);
  equalTokens(root, "<h1>hello!</h1><div>content</div>");
});

QUnit.test("HTML attributes", assert => {
  let template = compile("<div class='foo' id='bar'>content</div>");
  render(template, {});

  equalTokens(root, '<div class="foo" id="bar">content</div>');
});

QUnit.test("HTML tag with empty attribute", assert => {
  let template = compile("<div class=''>content</div>");
  render(template, {});

  equalTokens(root, "<div class=''>content</div>");
});

QUnit.test("HTML boolean attribute 'disabled'", assert => {
  let template = compile('<input disabled>');
  render(template, {});

  assert.ok(root.firstChild['disabled'], 'disabled without value set as property is true');
});

QUnit.test("Quoted attribute null values do not disable", assert => {
  let template = compile('<input disabled="{{isDisabled}}">');
  render(template, { isDisabled: null });

  assert.equal(root.firstChild['disabled'], false);
  equalTokens(root, '<input />');
});

QUnit.test("Unquoted attribute expression with null value is not coerced", assert => {
  let template = compile('<input disabled={{isDisabled}}>');
  render(template, { isDisabled: null });

  equalTokens(root, '<input>');
});

QUnit.test("Unquoted attribute values", assert => {
  let template = compile('<input value=funstuff>');
  render(template, {});

  let inputNode: any = root.firstChild;

  assert.equal(inputNode.tagName, 'INPUT', 'input tag');
  assert.equal(inputNode.value, 'funstuff', 'value is set as property');
});

QUnit.test("Unquoted attribute expression with string value is not coerced", assert => {
  let template = compile('<input value={{funstuff}}>');
  render(template, {funstuff: "oh my"});

  let inputNode: any = root.firstChild;

  assert.equal(inputNode.tagName, 'INPUT', 'input tag');
  assert.equal(inputNode.value, 'oh my', 'string is set to property');
});

QUnit.test("Unquoted img src attribute is rendered", assert => {
  let template = compile('<img src={{someURL}}>');
  render(template, { someURL: "http://foo.com/foo.png"});

  let imgNode: any = root.firstChild;

  equalTokens(root, '<img src="http://foo.com/foo.png">');
  assert.equal(imgNode.tagName, 'IMG', 'img tag');
  assert.equal(imgNode.src, 'http://foo.com/foo.png', 'string is set to property');
});

QUnit.test("Unquoted img src attribute is not rendered when set to `null`", assert => {
  let template = compile('<img src={{someURL}}>');
  render(template, { someURL: null});

  equalTokens(root, '<img>');
});

QUnit.test("Unquoted img src attribute is not rendered when set to `undefined`", assert => {
  let template = compile('<img src={{someURL}}>');
  render(template, { someURL: undefined });

  equalTokens(root, '<img>');
});

QUnit.test("Quoted img src attribute is rendered", assert => {
  let template = compile('<img src="{{someURL}}">');
  render(template, { someURL: "http://foo.com/foo.png"});

  let imgNode: any = root.firstChild;

  assert.equal(imgNode.tagName, 'IMG', 'img tag');
  assert.equal(imgNode.src, 'http://foo.com/foo.png', 'string is set to property');
});

QUnit.test("Quoted img src attribute is not rendered when set to `null`", assert => {
  let template = compile('<img src="{{someURL}}">');
  render(template, { someURL: null});

  equalTokens(root, '<img>');
});

QUnit.test("Quoted img src attribute is not rendered when set to `undefined`", assert => {
  let template = compile('<img src="{{someURL}}">');
  render(template, { someURL: undefined });

  equalTokens(root, '<img>');
});

QUnit.test("Unquoted a href attribute is not rendered when set to `null`", assert => {
  let template = compile('<a href={{someURL}}></a>');
  render(template, { someURL: null});

  equalTokens(root, '<a></a>');
});

QUnit.test("Unquoted img src attribute is not rendered when set to `undefined`", assert => {
  let template = compile('<a href={{someURL}}></a>');
  render(template, { someURL: undefined});

  equalTokens(root, '<a></a>');
});

QUnit.test("Attribute expression can be followed by another attribute", assert => {
  let template = compile('<div foo="{{funstuff}}" name="Alice"></div>');
  render(template, {funstuff: "oh my"});

  equalTokens(root, '<div name="Alice" foo="oh my"></div>');
});

QUnit.test("Unquoted attribute with expression throws an exception", assert => {
  assert.expect(4);

  assert.throws(function() { compile('<img class=foo{{bar}}>'); }, expectedError(1));
  assert.throws(function() { compile('<img class={{foo}}{{bar}}>'); }, expectedError(1));
  assert.throws(function() { compile('<img \nclass={{foo}}bar>'); }, expectedError(2));
  assert.throws(function() { compile('<div \nclass\n=\n{{foo}}&amp;bar ></div>'); }, expectedError(4));

  function expectedError(line) {
    return new Error(
      `An unquoted attribute value must be a string or a mustache, ` +
      `preceeded by whitespace or a '=' character, and ` +
      `followed by whitespace, a '>' character, or '/>' (on line ${line})`
    );
  }
});

QUnit.test("HTML tag with data- attribute", assert => {
  let template = compile("<div data-some-data='foo'>content</div>");
  render(template, {});
  equalTokens(root, '<div data-some-data="foo">content</div>');
});

QUnit.test("<input> tag with 'checked' attribute", assert => {
  let template = compile("<input checked=\"checked\">");
  render(template, {});

  let inputNode = root.firstChild as HTMLInputElement;

  assert.equal(inputNode.tagName, 'INPUT', 'input tag');
  assert.equal(inputNode.checked, true, 'input tag is checked');
});

function shouldBeVoid(tagName) {
  root.innerHTML = "";
  let html = "<" + tagName + " data-foo='bar'><p>hello</p>";
  let template = compile(html);
  render(template, {});

  let tag = '<' + tagName + ' data-foo="bar">';
  let closing = '</' + tagName + '>';
  let extra = "<p>hello</p>";
  html = normalizeInnerHTML(root.innerHTML);

  root = rootElement();

  QUnit.push((html === tag + extra) || (html === tag + closing + extra), html, tag + closing + extra, tagName + " should be a void element");
}

QUnit.test("Void elements are self-closing", assert => {
  let voidElements = "area base br col command embed hr img input keygen link meta param source track wbr";

  voidElements.split(" ").forEach((tagName) => shouldBeVoid(tagName));
});

QUnit.test("The compiler can handle nesting", assert => {
  let html = '<div class="foo"><p><span id="bar" data-foo="bar">hi!</span></p></div>&nbsp;More content';
  let template = compile(html);
  render(template, {});

  equalTokens(root, html);
});

QUnit.test("The compiler can handle quotes", assert => {
  compilesTo('<div>"This is a title," we\'re on a boat</div>');
});

QUnit.test("The compiler can handle backslashes", assert => {
  compilesTo('<div>This is a backslash: \\</div>');
});

QUnit.test("The compiler can handle newlines", assert => {
  compilesTo("<div>common\n\nbro</div>");
});

QUnit.test("The compiler can handle comments", assert => {
  compilesTo("<div>{{! Better not break! }}content</div>", '<div>content</div>', {});
});

QUnit.test("The compiler can handle HTML comments", assert => {
  compilesTo('<div><!-- Just passing through --></div>');
});

QUnit.test("The compiler can handle HTML comments with mustaches in them", assert => {
  compilesTo('<div><!-- {{foo}} --></div>', '<div><!-- {{foo}} --></div>', { foo: 'bar' });
});

QUnit.test("The compiler can handle HTML comments with complex mustaches in them", assert => {
  compilesTo('<div><!-- {{foo bar baz}} --></div>', '<div><!-- {{foo bar baz}} --></div>', { foo: 'bar' });
});

QUnit.test("The compiler can handle HTML comments with multi-line mustaches in them", assert => {
  compilesTo('<div><!-- {{#each foo as |bar|}}\n{{bar}}\n\n{{/each}} --></div>');
});

QUnit.test('The compiler can handle comments with no parent element', function() {
  compilesTo('<!-- {{foo}} -->');
});

// TODO: Revisit partial syntax.
// test("The compiler can handle partials in handlebars partial syntax", function() {
//   registerPartial('partial_name', "<b>Partial Works!</b>");
//   compilesTo('<div>{{>partial_name}} Plaintext content</div>', '<div><b>Partial Works!</b> Plaintext content</div>', {});
// });

QUnit.test("The compiler can handle simple handlebars", assert => {
  compilesTo('<div>{{title}}</div>', '<div>hello</div>', { title: 'hello' });
});

QUnit.test("The compiler can handle escaping HTML", assert => {
  compilesTo('<div>{{title}}</div>', '<div>&lt;strong&gt;hello&lt;/strong&gt;</div>', { title: '<strong>hello</strong>' });
});

QUnit.test("The compiler can handle unescaped HTML", assert => {
  compilesTo('<div>{{{title}}}</div>', '<div><strong>hello</strong></div>', { title: '<strong>hello</strong>' });
});

QUnit.test("The compiler can handle top-level unescaped HTML", assert => {
  compilesTo('{{{html}}}', '<strong>hello</strong>', { html: '<strong>hello</strong>' });
});

function createElement(tag) {
  return env.getDOM().createElement(tag);
}

QUnit.test("The compiler can handle top-level unescaped tr", assert => {
  let template = compile('{{{html}}}');
  let context = { html: '<tr><td>Yo</td></tr>' };
  root = createElement('table') as HTMLTableElement;
  render(template, context);

  assert.equal(root.firstChild['tagName'], 'TBODY', "root tbody is present");
});

QUnit.test("The compiler can handle top-level unescaped td inside tr contextualElement", assert => {
  let template = compile('{{{html}}}');
  let context = { html: '<td>Yo</td>' };
  root = createElement('tr') as HTMLTableRowElement;
  render(template, context);

  assert.equal(root.firstChild['tagName'], 'TD', "root td is returned");
});

QUnit.test("second render respects whitespace", assert => {
  let template = compile('Hello {{ foo }} ');
  render(template, {});

  root = rootElement();
  render(template, {});
  assert.equal(root.childNodes.length, 3, 'fragment contains 3 text nodes');
  assert.equal(getTextContent(root.childNodes[0]), 'Hello ', 'first text node ends with one space character');
  assert.equal(getTextContent(root.childNodes[2]), ' ', 'last text node contains one space character');
});

QUnit.test("Morphs are escaped correctly", assert => {
  env.registerHelper('testing-unescaped', function(params) {
    return params[0];
  });

  env.registerHelper('testing-escaped', function(params, hash) {
    return params[0];
  });

  compilesTo('<div>{{{testing-unescaped "<span>hi</span>"}}}</div>', '<div><span>hi</span></div>');
  compilesTo('<div>{{testing-escaped "<hi>"}}</div>', '<div>&lt;hi&gt;</div>');
});

QUnit.test("Attributes can use computed values", assert => {
  compilesTo('<a href="{{url}}">linky</a>', '<a href="linky.html">linky</a>', { url: 'linky.html' });
});

QUnit.test("Mountain range of nesting", assert => {
  let context = { foo: "FOO", bar: "BAR", baz: "BAZ", boo: "BOO", brew: "BREW", bat: "BAT", flute: "FLUTE", argh: "ARGH" };
  compilesTo('{{foo}}<span></span>', 'FOO<span></span>', context);
  compilesTo('<span></span>{{foo}}', '<span></span>FOO', context);
  compilesTo('<span>{{foo}}</span>{{foo}}', '<span>FOO</span>FOO', context);
  compilesTo('{{foo}}<span>{{foo}}</span>{{foo}}', 'FOO<span>FOO</span>FOO', context);
  compilesTo('{{foo}}<span></span>{{foo}}', 'FOO<span></span>FOO', context);
  compilesTo('{{foo}}<span></span>{{bar}}<span><span><span>{{baz}}</span></span></span>',
             'FOO<span></span>BAR<span><span><span>BAZ</span></span></span>', context);
  compilesTo('{{foo}}<span></span>{{bar}}<span>{{argh}}<span><span>{{baz}}</span></span></span>',
             'FOO<span></span>BAR<span>ARGH<span><span>BAZ</span></span></span>', context);
  compilesTo('{{foo}}<span>{{bar}}<a>{{baz}}<em>{{boo}}{{brew}}</em>{{bat}}</a></span><span><span>{{flute}}</span></span>{{argh}}',
             'FOO<span>BAR<a>BAZ<em>BOOBREW</em>BAT</a></span><span><span>FLUTE</span></span>ARGH', context);
});

QUnit.test("Static <div class> is preserved properly", assert => {
  compilesTo(`
    <div class="hello world">1</div>
    <div class="goodbye world">2</div>
  `, `
    <div class="hello world">1</div>
    <div class="goodbye world">2</div>
  `);
});

QUnit.test("Static <option selected> is preserved properly", assert => {
  let template = compile(`
    <select>
      <option>1</option>
      <option selected>2</option>
      <option>3</option>
    </select>
  `);
  render(template, {});

  let selectNode: any = root.childNodes[1];

  assert.equal(selectNode.selectedIndex, 1, 'second item is selected');
});

QUnit.test("Static <option selected> for multi-select is preserved properly", assert => {
  let template = compile(`
    <select multiple>
      <option selected>1</option>
      <option selected>2</option>
      <option>3</option>
    </select>
  `);
  render(template, {});

  let selectNode: any = root.childNodes[1];

  let options = selectNode.querySelectorAll('option[selected]');

  assert.equal(options.length, 2, 'two options are selected');
});

QUnit.test("Dynamic <option selected> is preserved properly", assert => {
  let template = compile(`
    <select>
      <option>1</option>
      <option selected={{selected}}>2</option>
      <option>3</option>
    </select>
  `);
  render(template, { selected: true });

  let selectNode: any = root.childNodes[1];

  assert.equal(selectNode.selectedIndex, 1, 'second item is selected');
});

QUnit.test("Dynamic <option selected> for multi-select is preserved properly", assert => {
  let template = compile(`
    <select multiple>
      <option>0</option>
      <option selected={{somethingTrue}}>1</option>
      <option selected={{somethingTruthy}}>2</option>
      <option selected={{somethingUndefined}}>3</option>
      <option selected={{somethingNull}}>4</option>
      <option selected={{somethingFalse}}>5</option>
    </select>
  `);

  render(template, {
    somethingTrue: true,
    somethingTruthy: 'is-true',
    somethingUndefined: undefined,
    somethingNull: null,
    somethingFalse: false
  });

  let selectNode: any = root.childNodes[1];
  let options = Array.prototype.slice.call(selectNode.querySelectorAll('option'));
  let selected = options.filter(option => option.selected);

  assert.equal(selected.length, 2, 'two options are selected');
  assert.equal(selected[0].value, '1', 'first selected item is "1"');
  assert.equal(selected[1].value, '2', 'second selected item is "2"');
});

module("Initial render - simple blocks");

QUnit.test("The compiler can handle unescaped tr in top of content", assert => {
  let template = compile('{{#identity}}{{{html}}}{{/identity}}');
  let context = { html: '<tr><td>Yo</td></tr>' };
  root = createElement('table') as HTMLTableElement;
  render(template, context);

  assert.equal(root.firstChild['tagName'], 'TBODY', "root tbody is present" );
});

QUnit.test("The compiler can handle unescaped tr inside fragment table", assert => {
  let template = compile('<table>{{#identity}}{{{html}}}{{/identity}}</table>');
  let context = { html: '<tr><td>Yo</td></tr>' };
  render(template, context);
  let tableNode = root.firstChild;

  assert.equal( tableNode.firstChild['tagName'], 'TBODY', "root tbody is present" );
});

module("Initial render - inline helpers");

QUnit.test("The compiler can handle simple helpers", assert => {
  env.registerHelper('testing', function(params) {
    return params[0];
  });

  compilesTo('<div>{{testing title}}</div>', '<div>hello</div>', { title: 'hello' });
});

QUnit.test("GH#13999 The compiler can handle simple helpers with inline null parameter", assert => {
  let value;
  env.registerHelper('say-hello', function(params) {
    value = params[0];
    return 'hello';
  });

  compilesTo('<div>{{say-hello null}}</div>', '<div>hello</div>');
  assert.strictEqual(value, null, 'is null');
});

QUnit.test("GH#13999 The compiler can handle simple helpers with inline string literal null parameter", assert => {
  let value;
  env.registerHelper('say-hello', function(params) {
    value = params[0];
    return 'hello';
  });

  compilesTo('<div>{{say-hello "null"}}</div>', '<div>hello</div>');
  assert.strictEqual(value, 'null', 'is null string literal');
});

QUnit.test("GH#13999 The compiler can handle simple helpers with inline undefined parameter", assert => {
  let value = 'PLACEHOLDER';
  let length;
  env.registerHelper('say-hello', function(params) {
    length = params.length;
    value = params[0];
    return 'hello';
  });

  compilesTo('<div>{{say-hello undefined}}</div>', '<div>hello</div>');
  assert.strictEqual(length, 1);
  assert.strictEqual(value, undefined, 'is undefined');
});

QUnit.test("GH#13999 The compiler can handle simple helpers with positional parameter undefined string literal", assert => {
  let value = 'PLACEHOLDER';
  let length;
  env.registerHelper('say-hello', function(params) {
    length = params.length;
    value = params[0];
    return 'hello';
  });

  compilesTo('<div>{{say-hello "undefined"}} undefined</div>', '<div>hello undefined</div>');
  assert.strictEqual(length, 1);
  assert.strictEqual(value, 'undefined', 'is undefined string literal');
});

QUnit.test("GH#13999 The compiler can handle components with undefined named arguments", assert => {
  let value = 'PLACEHOLDER';
  env.registerHelper('say-hello', function(_, hash) {
    value = hash['foo'];
    return 'hello';
  });

  compilesTo('<div>{{say-hello foo=undefined}}</div>', '<div>hello</div>');
  assert.strictEqual(value, undefined, 'is undefined');
});

QUnit.test("GH#13999 The compiler can handle components with undefined string literal named arguments", assert => {
  let value = 'PLACEHOLDER';
  env.registerHelper('say-hello', function(_, hash) {
    value = hash['foo'];
    return 'hello';
  });

  compilesTo('<div>{{say-hello foo="undefined"}}</div>', '<div>hello</div>');
  assert.strictEqual(value, 'undefined', 'is undefined string literal');
});

QUnit.test("GH#13999 The compiler can handle components with null named arguments", assert => {
  let value;
  env.registerHelper('say-hello', function(_, hash) {
    value = hash['foo'];
    return 'hello';
  });

  compilesTo('<div>{{say-hello foo=null}}</div>', '<div>hello</div>');
  assert.strictEqual(value, null, 'is null');
});

QUnit.test("GH#13999 The compiler can handle components with null string literal named arguments", assert => {
  let value;
  env.registerHelper('say-hello', function(_, hash) {
    value = hash['foo'];
    return 'hello';
  });

  compilesTo('<div>{{say-hello foo="null"}}</div>', '<div>hello</div>');
  assert.strictEqual(value, 'null', 'is null string literal');
});

QUnit.test("GH#13999 The compiler can handle components with undefined named arguments", assert => {
  env.registerHelper('say-hello', function() {
    return 'hello';
  });

  compilesTo('<div>{{say-hello foo=undefined}}</div>', '<div>hello</div>');
});

QUnit.test("Null curly in attributes", assert => {
  compilesTo('<div class="foo {{null}}">hello</div>', '<div class="foo ">hello</div>');
});

QUnit.test("Null in primitive syntax", assert => {
  compilesTo('{{#if null}}NOPE{{else}}YUP{{/if}}', 'YUP');
});

QUnit.test("The compiler can handle sexpr helpers", assert => {
  env.registerHelper('testing', function(params) {
    return params[0] + "!";
  });

  compilesTo('<div>{{testing (testing "hello")}}</div>', '<div>hello!!</div>', {});
});

QUnit.test("The compiler can handle multiple invocations of sexprs", assert => {
  env.registerHelper('testing', function(params) {
    return "" + params[0] + params[1];
  });

  compilesTo(
    '<div>{{testing (testing "hello" foo) (testing (testing bar "lol") baz)}}</div>',
    '<div>helloFOOBARlolBAZ</div>',
    { foo: "FOO", bar: "BAR", baz: "BAZ" }
  );
});

QUnit.test("The compiler passes along the hash arguments", assert => {
  env.registerHelper('testing', function(params, hash) {
    return hash['first'] + '-' + hash['second'];
  });

  compilesTo('<div>{{testing first="one" second="two"}}</div>', '<div>one-two</div>');
});

// test("Attributes can use computed paths", function() {
//   compilesTo('<a href="{{post.url}}">linky</a>', '<a href="linky.html">linky</a>', { post: { url: 'linky.html' }});
// });

/*

QUnit.test("It is possible to use RESOLVE_IN_ATTR for data binding", assert => {
  let callback;

  registerHelper('RESOLVE_IN_ATTR', function(parts, options) {
    return boundValue(function(c) {
      callback = c;
      return this[parts[0]];
    }, this);
  });

  let object = { url: 'linky.html' };
  let fragment = compilesTo('<a href="{{url}}">linky</a>', '<a href="linky.html">linky</a>', object);

  object.url = 'clippy.html';
  callback();

  equalTokens(fragment, '<a href="clippy.html">linky</a>');

  object.url = 'zippy.html';
  callback();

  equalTokens(fragment, '<a href="zippy.html">linky</a>');
});
*/

QUnit.test("Attributes can be populated with helpers that generate a string", assert => {
  env.registerHelper('testing', function(params) {
    return params[0];
  });

  compilesTo('<a href="{{testing url}}">linky</a>', '<a href="linky.html">linky</a>', { url: 'linky.html'});
});
/*
QUnit.test("A helper can return a stream for the attribute", assert => {
  env.registerHelper('testing', function(path, options) {
    return streamValue(this[path]);
  });

  compilesTo('<a href="{{testing url}}">linky</a>', '<a href="linky.html">linky</a>', { url: 'linky.html'});
});
*/
QUnit.test("Attribute helpers take a hash", assert => {
  env.registerHelper('testing', function(params, hash) {
    return hash['path'];
  });

  compilesTo('<a href="{{testing path=url}}">linky</a>', '<a href="linky.html">linky</a>', { url: 'linky.html' });
});
/*
QUnit.test("Attribute helpers can use the hash for data binding", assert => {
  let callback;

  env.registerHelper('testing', function(path, hash, options) {
    return boundValue(function(c) {
      callback = c;
      return this[path] ? hash.truthy : hash.falsy;
    }, this);
  });

  let object = { on: true };
  let fragment = compilesTo('<div class="{{testing on truthy="yeah" falsy="nope"}}">hi</div>', '<div class="yeah">hi</div>', object);

  object.on = false;
  callback();
  equalTokens(fragment, '<div class="nope">hi</div>');
});
*/
QUnit.test("Attributes containing multiple helpers are treated like a block", assert => {
  env.registerHelper('testing', function(params) {
    return params[0];
  });

  compilesTo(
    '<a href="http://{{foo}}/{{testing bar}}/{{testing "baz"}}">linky</a>',
    '<a href="http://foo.com/bar/baz">linky</a>',
    { foo: 'foo.com', bar: 'bar' }
  );
});

QUnit.test("Attributes containing a helper are treated like a block", assert => {
  env.registerHelper('testing', function(params) {
    assert.deepEqual(params, [123]);
    return "example.com";
  });

  compilesTo(
    '<a href="http://{{testing 123}}/index.html">linky</a>',
    '<a href="http://example.com/index.html">linky</a>',
    { person: { url: 'example.com' } }
  );
});
/*
QUnit.test("It is possible to trigger a re-render of an attribute from a child resolution", assert => {
  let callback;

  env.registerHelper('RESOLVE_IN_ATTR', function(path, options) {
    return boundValue(function(c) {
      callback = c;
      return this[path];
    }, this);
  });

  let context = { url: "example.com" };
  let fragment = compilesTo('<a href="http://{{url}}/index.html">linky</a>', '<a href="http://example.com/index.html">linky</a>', context);

  context.url = "www.example.com";
  callback();

  equalTokens(fragment, '<a href="http://www.example.com/index.html">linky</a>');
});

QUnit.test("A child resolution can pass contextual information to the parent", assert => {
  let callback;

  registerHelper('RESOLVE_IN_ATTR', function(path, options) {
    return boundValue(function(c) {
      callback = c;
      return this[path];
    }, this);
  });

  let context = { url: "example.com" };
  let fragment = compilesTo('<a href="http://{{url}}/index.html">linky</a>', '<a href="http://example.com/index.html">linky</a>', context);

  context.url = "www.example.com";
  callback();

  equalTokens(fragment, '<a href="http://www.example.com/index.html">linky</a>');
});

QUnit.test("Attribute runs can contain helpers", assert => {
  let callbacks = [];

  registerHelper('RESOLVE_IN_ATTR', function(path, options) {
    return boundValue(function(c) {
      callbacks.push(c);
      return this[path];
    }, this);
  });

  registerHelper('testing', function(path, options) {
    return boundValue(function(c) {
      callbacks.push(c);

      if (options.paramTypes[0] === 'id') {
        return this[path] + '.html';
      } else {
        return path;
      }
    }, this);
  });

  let context = { url: "example.com", path: 'index' };
  let fragment = compilesTo(
    '<a href="http://{{url}}/{{testing path}}/{{testing "linky"}}">linky</a>',
    '<a href="http://example.com/index.html/linky">linky</a>',
    context
  );

  context.url = "www.example.com";
  context.path = "yep";
  forEach(callbacks, function(callback) { callback(); });

  equalTokens(fragment, '<a href="http://www.example.com/yep.html/linky">linky</a>');

  context.url = "nope.example.com";
  context.path = "nope";
  forEach(callbacks, function(callback) { callback(); });

  equalTokens(fragment, '<a href="http://nope.example.com/nope.html/linky">linky</a>');
});
*/
QUnit.test("Elements inside a yielded block", assert => {
  compilesTo('{{#identity}}<div id="test">123</div>{{/identity}}', '<div id="test">123</div>');
});

QUnit.test("A simple block helper can return text", assert => {
  compilesTo('{{#identity}}test{{else}}not shown{{/identity}}', 'test');
});

QUnit.test("A block helper can have an else block", assert => {
  compilesTo('{{#render-inverse}}Nope{{else}}<div id="test">123</div>{{/render-inverse}}', '<div id="test">123</div>');
});

module("Initial render - miscellaneous");

QUnit.test('Components - Unknown helpers fall back to elements', function () {
  let object = { size: 'med', foo: 'b' };
  compilesTo('<x-bar class="btn-{{size}}">a{{foo}}c</x-bar>','<x-bar class="btn-med">abc</x-bar>', object);
});

QUnit.test('Components - Text-only attributes work', function () {
  let object = { foo: 'qux' };
  compilesTo('<x-bar id="test">{{foo}}</x-bar>','<x-bar id="test">qux</x-bar>', object);
});

QUnit.test('Components - Empty components work', function () {
  compilesTo('<x-bar></x-bar>','<x-bar></x-bar>', {});
});

QUnit.test('Components - Text-only dashed attributes work', function () {
  let object = { foo: 'qux' };
  compilesTo('<x-bar aria-label="foo" id="test">{{foo}}</x-bar>','<x-bar aria-label="foo" id="test">qux</x-bar>', object);
});

QUnit.test('Repaired text nodes are ensured in the right place', function () {
  let object = { a: "A", b: "B", c: "C", d: "D" };
  compilesTo('{{a}} {{b}}', 'A B', object);
  compilesTo('<div>{{a}}{{b}}{{c}}wat{{d}}</div>', '<div>ABCwatD</div>', object);
  compilesTo('{{a}}{{b}}<img><img><img><img>', 'AB<img><img><img><img>', object);
});

QUnit.test("Simple elements can have dashed attributes", assert => {
  let template = compile("<div aria-label='foo'>content</div>");
  render(template, {});

  equalTokens(root, '<div aria-label="foo">content</div>');
});

QUnit.test('Block params in HTML syntax - Throws exception if given zero parameters', assert => {
  assert.expect(2);

  assert.throws(function() {
    compile('<x-bar as ||>foo</x-bar>');
  }, /Cannot use zero block parameters: 'as \|\|'/);
  assert.throws(function() {
    compile('<x-bar as | |>foo</x-bar>');
  }, /Cannot use zero block parameters: 'as \| \|'/);
});

QUnit.test("Block params in HTML syntax - Throws an error on invalid block params syntax", assert => {
  assert.expect(3);

  assert.throws(function() {
    compile('<x-bar as |x y>{{x}},{{y}}</x-bar>');
  }, /Invalid block parameters syntax: 'as |x y'/);
  assert.throws(function() {
    compile('<x-bar as |x| y>{{x}},{{y}}</x-bar>');
  }, /Invalid block parameters syntax: 'as \|x\| y'/);
  assert.throws(function() {
    compile('<x-bar as |x| y|>{{x}},{{y}}</x-bar>');
  }, /Invalid block parameters syntax: 'as \|x\| y\|'/);
});

QUnit.test("Block params in HTML syntax - Throws an error on invalid identifiers for params", assert => {
  assert.expect(3);

  assert.throws(function() {
    compile('<x-bar as |x foo.bar|></x-bar>');
  }, /Invalid identifier for block parameters: 'foo\.bar' in 'as \|x foo\.bar|'/);
  assert.throws(function() {
    compile('<x-bar as |x "foo"|></x-bar>');
  }, /Invalid identifier for block parameters: '"foo"' in 'as \|x "foo"|'/);
  assert.throws(function() {
    compile('<x-bar as |foo[bar]|></x-bar>');
  }, /Invalid identifier for block parameters: 'foo\[bar\]' in 'as \|foo\[bar\]\|'/);
});

module("Initial render (invalid HTML)");

QUnit.test("A helpful error message is provided for unclosed elements", assert => {
  assert.expect(2);

  assert.throws(function() {
    compile('\n<div class="my-div" \n foo={{bar}}>\n<span>\n</span>\n');
  }, /Unclosed element `div` \(on line 2\)\./);
  assert.throws(function() {
    compile('\n<div class="my-div">\n<span>\n');
  }, /Unclosed element `span` \(on line 3\)\./);
});

QUnit.test("A helpful error message is provided for unmatched end tags", assert => {
  assert.expect(2);

  assert.throws(function() {
    compile("</p>");
  }, /Closing tag `p` \(on line 1\) without an open tag\./);
  assert.throws(function() {
    compile("<em>{{ foo }}</em> \n {{ bar }}\n</div>");
  }, /Closing tag `div` \(on line 3\) without an open tag\./);
});

QUnit.test("A helpful error message is provided for end tags for void elements", assert => {
  assert.expect(3);

  assert.throws(function() {
    compile("<input></input>");
  }, /Invalid end tag `input` \(on line 1\) \(void elements cannot have end tags\)./);
  assert.throws(function() {
    compile("<div>\n  <input></input>\n</div>");
  }, /Invalid end tag `input` \(on line 2\) \(void elements cannot have end tags\)./);
  assert.throws(function() {
    compile("\n\n</br>");
  }, /Invalid end tag `br` \(on line 3\) \(void elements cannot have end tags\)./);
});

QUnit.test("A helpful error message is provided for end tags with attributes", assert => {
  assert.throws(function() {
    compile('<div>\nSomething\n\n</div foo="bar">');
  }, /Invalid end tag: closing tag must not have attributes, in `div` \(on line 4\)\./);
});

QUnit.test("A helpful error message is provided for mismatched start/end tags", assert => {
  assert.throws(function() {
    compile("<div>\n<p>\nSomething\n\n</div>");
  }, /Closing tag `div` \(on line 5\) did not match last open tag `p` \(on line 2\)\./);
});

QUnit.test("error line numbers include comment lines", assert => {
  assert.throws(function() {
    compile("<div>\n<p>\n{{! some comment}}\n\n</div>");
  }, /Closing tag `div` \(on line 5\) did not match last open tag `p` \(on line 2\)\./);
});

QUnit.test("error line numbers include mustache only lines", assert => {
  assert.throws(function() {
    compile("<div>\n<p>\n{{someProp}}\n\n</div>");
  }, /Closing tag `div` \(on line 5\) did not match last open tag `p` \(on line 2\)\./);
});

QUnit.test("error line numbers include block lines", assert => {
  assert.throws(function() {
    compile("<div>\n<p>\n{{#some-comment}}\n{{/some-comment}}\n</div>");
  }, /Closing tag `div` \(on line 5\) did not match last open tag `p` \(on line 2\)\./);
});

QUnit.test("error line numbers include whitespace control mustaches", assert => {
  assert.throws(function() {
    compile("<div>\n<p>\n{{someProp~}}\n\n</div>{{some-comment}}");
  }, /Closing tag `div` \(on line 5\) did not match last open tag `p` \(on line 2\)\./);
});

QUnit.test("error line numbers include multiple mustache lines", assert => {
  assert.throws(function() {
    compile("<div>\n<p>\n{{some-comment}}</div>{{some-comment}}");
  }, /Closing tag `div` \(on line 3\) did not match last open tag `p` \(on line 2\)\./);
});

module("Initial render of namespaced HTML");

QUnit.test("Namespaced attribute", assert => {
  compilesTo("<svg xlink:title='svg-title'>content</svg>");
  let svg = root.firstChild;
  assert.equal(svg.namespaceURI, SVG_NAMESPACE);
  assert.equal(svg.attributes[0].namespaceURI, XLINK_NAMESPACE);
});

QUnit.test("<svg> tag with case-sensitive attribute", assert => {
  let viewBox = '0 0 0 0';
  compilesTo(`<svg viewBox="${viewBox}"></svg>`);
  let svg = root.firstChild as SVGSVGElement;
  assert.equal(svg.namespaceURI, SVG_NAMESPACE);
  assert.equal(svg.getAttribute('viewBox'), viewBox);
});

QUnit.test("nested element in the SVG namespace", assert => {
  let d = 'M 0 0 L 100 100';
  compilesTo(`<svg><path d="${d}"></path></svg>`);
  let svg = root.firstChild as SVGSVGElement;
  let path = svg.firstChild as SVGPathElement;
  assert.equal(svg.namespaceURI, SVG_NAMESPACE);
  assert.equal(path.namespaceURI, SVG_NAMESPACE,
        "creates the path element with a namespace");
  assert.equal(path.getAttribute('d'), d);
});

QUnit.test("<foreignObject> tag has an SVG namespace", assert => {
  compilesTo('<svg><foreignObject>Hi</foreignObject></svg>');
  let svg = root.firstChild;
  let foreignObject = svg.firstChild;
  assert.equal(svg.namespaceURI, SVG_NAMESPACE);
  assert.equal(foreignObject.namespaceURI, SVG_NAMESPACE,
        "creates the foreignObject element with a namespace");
});

QUnit.test("Namespaced and non-namespaced elements as siblings", assert => {
  compilesTo('<svg></svg><svg></svg><div></div>');
  assert.equal(root.childNodes[0].namespaceURI, SVG_NAMESPACE,
        "creates the first svg element with a namespace");
  assert.equal(root.childNodes[1].namespaceURI, SVG_NAMESPACE,
        "creates the second svg element with a namespace");
  assert.equal(root.childNodes[2].namespaceURI, XHTML_NAMESPACE,
        "creates the div element without a namespace");
});

QUnit.test("Namespaced and non-namespaced elements with nesting", assert => {
  compilesTo('<div><svg></svg></div><div></div>');
  let firstDiv = root.firstChild;
  let secondDiv = root.lastChild;
  let svg = firstDiv.firstChild;
  assert.equal(firstDiv.namespaceURI, XHTML_NAMESPACE,
        "first div's namespace is xhtmlNamespace");
  assert.equal(svg.namespaceURI, SVG_NAMESPACE,
        "svg's namespace is svgNamespace");
  assert.equal(secondDiv.namespaceURI, XHTML_NAMESPACE,
        "last div's namespace is xhtmlNamespace");
});

QUnit.test("Case-sensitive tag has capitalization preserved", assert => {
  compilesTo('<svg><linearGradient id="gradient"></linearGradient></svg>');
});

let warnings = 0;

class StyleAttribute extends AttributeManager {
  setAttribute(dom, element, value) {
    warnings++;
    super.setAttribute(dom, element, value);
  }

  updateAttribute() {}
}

const STYLE_ATTRIBUTE = new StyleAttribute('style');

QUnit.module('Style attributes', {
  beforeEach() {
    class StyleEnv extends TestEnvironment {
      attributeFor(element: Simple.Element, attr: string, isTrusting: boolean, namespace?: string): AttributeManager {
        if (attr === 'style' && !isTrusting) {
          return STYLE_ATTRIBUTE;
        }

        return super.attributeFor(element, attr, isTrusting);
      }
    }

    commonSetup(new StyleEnv());

  },
  afterEach() {
    warnings = 0;
  }
});

QUnit.test(`using a static inline style on an element does not give you a warning`, function(assert) {
  let template = compile(`<div style="background: red">Thing</div>`);
  render(template, {});

  assert.strictEqual(warnings, 0);

  equalTokens(root, '<div style="background: red">Thing</div>', "initial render");
});

QUnit.test(`triple curlies are trusted`, function(assert) {
  let template = compile(`<div foo={{foo}} style={{{styles}}}>Thing</div>`);
  render(template, {styles: 'background: red'});

  assert.strictEqual(warnings, 0);

  equalTokens(root, '<div style="background: red">Thing</div>', "initial render");
});

QUnit.test(`using a static inline style on an namespaced element does not give you a warning`, function(assert) {
  let template = compile(`<svg xmlns:svg="http://www.w3.org/2000/svg" style="background: red" />`);

  render(template, {});

  assert.strictEqual(warnings, 0);

  equalTokens(root, '<svg xmlns:svg="http://www.w3.org/2000/svg" style="background: red"></svg>', "initial render");
});
