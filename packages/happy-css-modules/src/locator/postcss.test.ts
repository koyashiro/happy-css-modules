import dedent from 'dedent';
import { createRoot, createClassSelectors, createAtImports, createFixtures } from '../test-util/util.js';
import { generateLocalTokenNames, getOriginalLocation, parseAtImport, collectNodes } from './postcss.js';

describe('generateLocalTokenNames', () => {
  test('basic', async () => {
    expect(
      await generateLocalTokenNames(
        createRoot(`
        .basic {}
        .cascading {}
        .cascading {}
        .pseudo_class_1 {}
        .pseudo_class_2:hover {}
        :not(.pseudo_class_3) {}
        .multiple_selector_1.multiple_selector_2 {}
        .combinator_1 + .combinator_2 {}
        @supports (display: flex) {
          @media screen and (min-width: 900px) {
            .at_rule {}
          }
        }
        .selector_list_1, .selector_list_2 {}
        :local .local_class_name_1 {}
        :local {
          .local_class_name_2 {}
          .local_class_name_3 {}
        }
        :local(.local_class_name_4) {}
        `),
      ),
    ).toStrictEqual([
      'basic',
      'cascading',
      'pseudo_class_1',
      'pseudo_class_2',
      'pseudo_class_3',
      'multiple_selector_1',
      'multiple_selector_2',
      'combinator_1',
      'combinator_2',
      'at_rule',
      'selector_list_1',
      'selector_list_2',
      'local_class_name_1',
      'local_class_name_2',
      'local_class_name_3',
      'local_class_name_4',
    ]);
  });
  test('does not track styles imported by @import in other file because it is not a local token', async () => {
    createFixtures({
      '/test/1.css': dedent`
      .a {}
      `,
    });
    expect(
      await generateLocalTokenNames(
        createRoot(`
        @import "/test/1.css";
        `),
      ),
    ).toStrictEqual([]);
  });
  test('does not track styles imported by @value in other file because it is not a local token', async () => {
    createFixtures({});
    expect(
      await generateLocalTokenNames(
        createRoot(`
        @value something from "/test/1.css";
        `),
      ),
    ).toStrictEqual([]);
  });
  test('does not track styles imported by composes in other file because it is not a local token', async () => {
    createFixtures({
      '/test/1.css': dedent`
      .b {}
      `,
    });
    expect(
      await generateLocalTokenNames(
        createRoot(`
        .a {
          composes: b from "/test/1.css";
        }
        `),
      ),
    ).toStrictEqual(['a']);
  });
});

describe('getOriginalLocation', () => {
  test('basic', () => {
    const [basic] = createClassSelectors(
      createRoot(dedent`
      .basic {}
      `),
    );
    expect(getOriginalLocation(basic!.rule, basic!.classSelector)).toMatchInlineSnapshot(
      `{ filePath: "/test/test.css", start: { line: 1, column: 1 }, end: { line: 1, column: 6 } }`,
    );
  });
  test('cascading', () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const [cascading_1, cascading_2] = createClassSelectors(
      createRoot(dedent`
      .cascading {}
      .cascading {}
      `),
    );
    expect(getOriginalLocation(cascading_1!.rule, cascading_1!.classSelector)).toMatchInlineSnapshot(
      `{ filePath: "/test/test.css", start: { line: 1, column: 1 }, end: { line: 1, column: 10 } }`,
    );
    expect(getOriginalLocation(cascading_2!.rule, cascading_2!.classSelector)).toMatchInlineSnapshot(
      `{ filePath: "/test/test.css", start: { line: 2, column: 1 }, end: { line: 2, column: 10 } }`,
    );
  });
  test('pseudo_class', () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const [pseudo_class_1, pseudo_class_2, pseudo_class_3] = createClassSelectors(
      createRoot(dedent`
      .pseudo_class_1 {}
      .pseudo_class_2:hover {}
      :not(.pseudo_class_3) {}
      `),
    );
    expect(getOriginalLocation(pseudo_class_1!.rule, pseudo_class_1!.classSelector)).toMatchInlineSnapshot(
      `{ filePath: "/test/test.css", start: { line: 1, column: 1 }, end: { line: 1, column: 15 } }`,
    );
    expect(getOriginalLocation(pseudo_class_2!.rule, pseudo_class_2!.classSelector)).toMatchInlineSnapshot(
      `{ filePath: "/test/test.css", start: { line: 2, column: 1 }, end: { line: 2, column: 15 } }`,
    );
    expect(getOriginalLocation(pseudo_class_3!.rule, pseudo_class_3!.classSelector)).toMatchInlineSnapshot(
      `{ filePath: "/test/test.css", start: { line: 3, column: 6 }, end: { line: 3, column: 20 } }`,
    );
  });
  test('multiple_selector', () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const [multiple_selector_1, multiple_selector_2] = createClassSelectors(
      createRoot(dedent`
      .multiple_selector_1.multiple_selector_2 {}
      `),
    );
    expect(getOriginalLocation(multiple_selector_1!.rule, multiple_selector_1!.classSelector)).toMatchInlineSnapshot(
      `{ filePath: "/test/test.css", start: { line: 1, column: 1 }, end: { line: 1, column: 20 } }`,
    );
    expect(getOriginalLocation(multiple_selector_2!.rule, multiple_selector_2!.classSelector)).toMatchInlineSnapshot(
      `{ filePath: "/test/test.css", start: { line: 1, column: 21 }, end: { line: 1, column: 40 } }`,
    );
  });

  test('combinator', () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const [combinator_1, combinator_2] = createClassSelectors(
      createRoot(dedent`
      .combinator_1 + .combinator_2 {}
      `),
    );
    expect(getOriginalLocation(combinator_1!.rule, combinator_1!.classSelector)).toMatchInlineSnapshot(
      `{ filePath: "/test/test.css", start: { line: 1, column: 1 }, end: { line: 1, column: 13 } }`,
    );
    expect(getOriginalLocation(combinator_2!.rule, combinator_2!.classSelector)).toMatchInlineSnapshot(
      `{ filePath: "/test/test.css", start: { line: 1, column: 17 }, end: { line: 1, column: 29 } }`,
    );
  });
  test('at_rule', () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const [at_rule] = createClassSelectors(
      createRoot(dedent`
      @supports (display: flex) {
        @media screen and (min-width: 900px) {
          .at_rule {}
        }
      }
      `),
    );
    expect(getOriginalLocation(at_rule!.rule, at_rule!.classSelector)).toMatchInlineSnapshot(
      `{ filePath: "/test/test.css", start: { line: 3, column: 5 }, end: { line: 3, column: 12 } }`,
    );
  });
  test('selector_list', () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const [selector_list_1, selector_list_2] = createClassSelectors(
      createRoot(dedent`
      .selector_list_1, .selector_list_2 {}
      `),
    );
    expect(getOriginalLocation(selector_list_1!.rule, selector_list_1!.classSelector)).toMatchInlineSnapshot(
      `{ filePath: "/test/test.css", start: { line: 1, column: 1 }, end: { line: 1, column: 16 } }`,
    );
    expect(getOriginalLocation(selector_list_2!.rule, selector_list_2!.classSelector)).toMatchInlineSnapshot(
      `{ filePath: "/test/test.css", start: { line: 1, column: 19 }, end: { line: 1, column: 34 } }`,
    );
  });
  test('local_class_name', () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const [local_class_name_1, local_class_name_2, local_class_name_3, local_class_name_4] = createClassSelectors(
      createRoot(dedent`
      :local .local_class_name_1 {}
      :local {
        .local_class_name_2 {}
        .local_class_name_3 {}
      }
      :local(.local_class_name_4) {}
      `),
    );
    expect(getOriginalLocation(local_class_name_1!.rule, local_class_name_1!.classSelector)).toMatchInlineSnapshot(
      `{ filePath: "/test/test.css", start: { line: 1, column: 8 }, end: { line: 1, column: 26 } }`,
    );
    expect(getOriginalLocation(local_class_name_2!.rule, local_class_name_2!.classSelector)).toMatchInlineSnapshot(
      `{ filePath: "/test/test.css", start: { line: 3, column: 3 }, end: { line: 3, column: 21 } }`,
    );
    expect(getOriginalLocation(local_class_name_3!.rule, local_class_name_3!.classSelector)).toMatchInlineSnapshot(
      `{ filePath: "/test/test.css", start: { line: 4, column: 3 }, end: { line: 4, column: 21 } }`,
    );
    expect(getOriginalLocation(local_class_name_4!.rule, local_class_name_4!.classSelector)).toMatchInlineSnapshot(
      `{ filePath: "/test/test.css", start: { line: 6, column: 8 }, end: { line: 6, column: 26 } }`,
    );
  });
  test('with_newline', () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const [with_newline_1, with_newline_2, with_newline_3] = createClassSelectors(
      createRoot(dedent`
      .with_newline_1,
      .with_newline_2
        + .with_newline_3, {}
      `),
    );
    expect(getOriginalLocation(with_newline_1!.rule, with_newline_1!.classSelector)).toMatchInlineSnapshot(
      `{ filePath: "/test/test.css", start: { line: 1, column: 1 }, end: { line: 1, column: 15 } }`,
    );
    expect(getOriginalLocation(with_newline_2!.rule, with_newline_2!.classSelector)).toMatchInlineSnapshot(
      `{ filePath: "/test/test.css", start: { line: 2, column: 1 }, end: { line: 2, column: 15 } }`,
    );

    expect(getOriginalLocation(with_newline_3!.rule, with_newline_3!.classSelector)).toMatchInlineSnapshot(
      `{ filePath: "/test/test.css", start: { line: 3, column: 5 }, end: { line: 3, column: 19 } }`,
    );
  });
});

test('collectNodes', () => {
  const ast = createRoot(dedent`
    @import;
    @import "test.css";
    @ignored;
    .a { ignored: "ignored"; }
    .b { ignored: "ignored"; }
    `);

  const { atImports, classSelectors } = collectNodes(ast);

  expect(atImports).toHaveLength(2);
  expect(atImports[0]!.toString()).toEqual('@import');
  expect(atImports[1]!.toString()).toEqual('@import "test.css"');
  expect(classSelectors).toHaveLength(2);
  expect(classSelectors[0]!.rule.toString()).toEqual('.a { ignored: "ignored"; }');
  expect(classSelectors[0]!.classSelector.toString()).toEqual('.a');
  expect(classSelectors[1]!.rule.toString()).toEqual('.b { ignored: "ignored"; }');
  expect(classSelectors[1]!.classSelector.toString()).toEqual('.b');
});

test('parseAtImport', () => {
  const atImports = createAtImports(
    createRoot(dedent`
    @import;
    @import "test.css";
    @import url("test.css");
    @import url(test.css);
    @import "test.css" print;
    `),
  );
  expect(parseAtImport(atImports[0]!)).toBe(undefined);
  expect(parseAtImport(atImports[1]!)).toBe('test.css');
  expect(parseAtImport(atImports[2]!)).toBe('test.css');
  expect(parseAtImport(atImports[3]!)).toBe('test.css');
  expect(parseAtImport(atImports[4]!)).toBe('test.css');
});
