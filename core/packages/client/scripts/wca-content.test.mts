import {test} from 'node:test';
import assert from 'node:assert/strict';
import {markdown,sanitize} from './wca-content.mts';
test('renders official move notation and placeholders without treating them as HTML',()=>{
 const result=markdown('Use <r> and <x, y, z>.\n\nSubject: <Location/Team> <!-- break -->');
 assert.ok(result.includes('&lt;r&gt;'));
 assert.ok(result.includes('&lt;x, y, z&gt;'));
 assert.ok(result.includes('&lt;Location/Team&gt;'));
 assert.ok(!result.includes('break'));
});
test('preserves link destinations, list starting number and safe email autolinks',()=>{
 const result=markdown('9. Ninth case\n\n<team@example.org>\n\n[Source](/posts/example)');
 assert.ok(result.includes('<ol start="9">'));
 assert.ok(result.includes('href="mailto:team@example.org"'));
 assert.equal(result.match(/href="([^"]+)"[^>]*>Source<\/a>/)?.[1], 'https://www.worldcubeassociation.org/posts/example');
});
test('removes active content from raw HTML and prevents unsafe link protocols',()=>{
 const result=sanitize('<p onclick="x()">Text<script>secret()</script><a href="javascript:x()">bad</a><img src="x" onerror="x()"><iframe src="https://example.org"></iframe></p>');
 assert.equal(result,'<p>Textbad</p>');
});

test('renders historical PDF links with literal spaces without editing saved sources',()=>{
 const result=markdown('[Motion](https://example.org/10.2022.0 - Committees and Teams.pdf)');
 assert.ok(result.includes('href="https://example.org/10.2022.0%20-%20Committees%20and%20Teams.pdf"'));
});

test('normalizes historical bare email link targets to mailto',()=>{
 assert.ok(markdown('[Contact](regulations@worldcubeassociation.org)').includes('href="mailto:regulations@worldcubeassociation.org"'));
});

test('preserves explicit email protocols and HTTPS paths containing email addresses',()=>{
 const result=markdown('[Contact](mailto:integrity@worldcubeassociation.org)\n\n[Profile](https://example.org/person/team@example.org)');
 assert.ok(result.includes('href="mailto:integrity@worldcubeassociation.org"'));
 assert.ok(result.includes('href="https://example.org/person/team@example.org"'));
 assert.ok(!result.includes('mailto:mailto:'));
 assert.equal(sanitize('<a href="javascript:team@example.org">unsafe</a>'),'unsafe');
});

test('keeps intentional historical case number gaps while allowing normal repeated Markdown numbering',()=>{
 assert.ok(markdown('6. Case six\n8. Case eight').includes('<li value="8">'));
 assert.ok(!markdown('1. First\n1. Second').includes('value="1"'));
});
