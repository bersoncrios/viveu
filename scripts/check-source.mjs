import ts from 'typescript';
import { parseTemplate } from '@angular/compiler';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

async function filesAt(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? filesAt(path.join(dir, e.name)) : [path.join(dir, e.name)]))).flat();
}
let failures = 0;
let templates = 0;
const files = (await filesAt('src')).filter(f => f.endsWith('.ts'));
for (const file of files) {
  const source = await readFile(file, 'utf8');
  const output = ts.transpileModule(source, {fileName: file, reportDiagnostics: true, compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, experimentalDecorators: true, isolatedModules: true}});
  for (const diagnostic of output.diagnostics ?? []) {
    if (diagnostic.category === ts.DiagnosticCategory.Error) {
      console.error(file, ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      failures++;
    }
  }
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(ast) === 'template' && (ts.isNoSubstitutionTemplateLiteral(node.initializer) || ts.isStringLiteral(node.initializer))) {
      templates++;
      for (const error of parseTemplate(node.initializer.text, file).errors ?? []) {console.error(String(error)); failures++;}
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
console.log(`${files.length} arquivos TypeScript; ${templates} templates Angular analisados. ${failures} erros de sintaxe.`);
console.log('Esta análise não substitui ng build, tipagem de templates ou testes Firebase HML.');
process.exitCode = failures ? 1 : 0;
