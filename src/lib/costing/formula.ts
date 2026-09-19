/**
 * A small, safe formula evaluator for a tenant's own costing rules.
 *
 * Grammar: numbers, names, + - * / ( ), and the functions max, min, round,
 * ceil, floor, abs. Nothing else - no assignment, no strings, no access to
 * anything but the names given. Written on paper it would look the same:
 *
 *   (runA + runB - blindCorner) * baseHeight
 *   ceil(width / 2)
 *
 * `evaluate` returns a number or an error message naming what went wrong,
 * so the Catalogue can show the mistake beside the formula as it is typed.
 */

type Tok = { t: "num"; v: number } | { t: "name"; v: string } | { t: "op"; v: string } | { t: "("; } | { t: ")" } | { t: "," };

const FUNCS: Record<string, (...a: number[]) => number> = {
  max: (...a) => Math.max(...a),
  min: (...a) => Math.min(...a),
  round: (a, d = 0) => Math.round(a * 10 ** d) / 10 ** d,
  ceil: (a) => Math.ceil(a),
  floor: (a) => Math.floor(a),
  abs: (a) => Math.abs(a),
};

function tokenize(src: string): Tok[] | string {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /^[0-9]*\.?[0-9]+/.exec(src.slice(i));
      if (!m) return `Bad number at ${i + 1}`;
      out.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      out.push({ t: "name", v: m[0] });
      i += m[0].length;
      continue;
    }
    if ("+-*/".includes(c) || c === "×" || c === "÷") { out.push({ t: "op", v: c === "×" ? "*" : c === "÷" ? "/" : c }); i++; continue; }
    if (c === "(") { out.push({ t: "(" }); i++; continue; }
    if (c === ")") { out.push({ t: ")" }); i++; continue; }
    if (c === ",") { out.push({ t: "," }); i++; continue; }
    return `Unexpected "${c}"`;
  }
  return out;
}

/** The names a formula refers to, for validation and dependency order. */
export function namesIn(src: string): string[] {
  const toks = tokenize(src);
  if (typeof toks === "string") return [];
  return [...new Set(toks.filter((t) => t.t === "name" && !(t.v in FUNCS)).map((t) => (t as { v: string }).v))];
}

export function evaluate(src: string, vars: Record<string, number>): { ok: true; value: number } | { ok: false; error: string } {
  const toks = tokenize(src.trim());
  if (typeof toks === "string") return { ok: false, error: toks };
  if (toks.length === 0) return { ok: false, error: "Empty formula" };
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const fail = (m: string): never => { throw new Error(m); };

  function expr(): number {
    let v = term();
    while (peek()?.t === "op" && ((peek() as { v: string }).v === "+" || (peek() as { v: string }).v === "-")) {
      const op = (next() as { v: string }).v;
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function term(): number {
    let v = unary();
    while (peek()?.t === "op" && ((peek() as { v: string }).v === "*" || (peek() as { v: string }).v === "/")) {
      const op = (next() as { v: string }).v;
      const r = unary();
      if (op === "/" && r === 0) fail("Division by zero");
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function unary(): number {
    if (peek()?.t === "op" && (peek() as { v: string }).v === "-") { next(); return -unary(); }
    if (peek()?.t === "op" && (peek() as { v: string }).v === "+") { next(); return unary(); }
    return atom();
  }
  function atom(): number {
    const t = next();
    if (!t) return fail("Formula ends too soon");
    if (t.t === "num") return t.v;
    if (t.t === "(") {
      const v = expr();
      if (next()?.t !== ")") fail("Missing )");
      return v;
    }
    if (t.t === "name") {
      if (t.v in FUNCS) {
        if (next()?.t !== "(") fail(`${t.v} needs ( )`);
        const args: number[] = [];
        if (peek()?.t !== ")") {
          args.push(expr());
          while (peek()?.t === ",") { next(); args.push(expr()); }
        }
        if (next()?.t !== ")") fail(`Missing ) after ${t.v}`);
        return FUNCS[t.v](...args);
      }
      if (!(t.v in vars)) fail(`"${t.v}" is not a field or quantity`);
      const v = vars[t.v];
      return Number.isFinite(v) ? v : 0;
    }
    return fail(`Unexpected ${"v" in t ? t.v : t.t}`);
  }

  try {
    const v = expr();
    if (p !== toks.length) return { ok: false, error: `Unexpected "${"v" in toks[p] ? (toks[p] as { v: string }).v : toks[p].t}"` };
    if (!Number.isFinite(v)) return { ok: false, error: "Result is not a number" };
    return { ok: true, value: v };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Bad formula" };
  }
}
