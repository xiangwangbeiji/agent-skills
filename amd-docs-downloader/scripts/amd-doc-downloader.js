// amd-doc-downloader.js —— 通用 AMD/Xilinx 文档 PDF 下载器
//   自动取最新版 · 双系统兼容 · 跨平台(优先系统 Edge, 回退自带 chromium)
//
// 用法:
//   node amd-doc-downloader.js <slug> [<slug> ...]
//   node amd-doc-downloader.js --out ./docs <slug> ...
//
// slug = docs.amd.com 文档页 URL 的最后一段, 例如:
//   https://docs.amd.com/r/en-US/ug904-vivado-implementation  ->  ug904-vivado-implementation
//
// 机制: docs.amd.com 有两套文档系统, 本工具自动识别:
//   1) 阅读器 /r/en-US/{slug}   -> /api/khub/maps/{mapId}/attachments/{id}/content
//   2) 查看器 /v/u/en-US/{slug} -> /api/khub/documents/{docId}/content
// 均打开"不带版本号"的 en-US 地址现场解析 ID, 因此始终得到最新版。

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";

function parseArgs(argv) {
  const out = { outDir: path.resolve("amd-docs"), slugs: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out" || argv[i] === "-o") out.outDir = path.resolve(argv[++i] || "amd-docs");
    else out.slugs.push(argv[i].toLowerCase().replace(/^\/+|\/+$/g, ""));
  }
  return out;
}

// 跨平台启动: 优先系统 Edge, 失败回退 Playwright 自带 chromium
async function launchBrowser() {
  const args = ["--no-sandbox", "--disable-gpu"];
  try {
    return await chromium.launch({ headless: true, channel: "msedge", args });
  } catch {
    console.log("  (未找到 Edge, 回退到 Playwright chromium)");
    return await chromium.launch({ headless: true, args });
  }
}

// 查看器: 版本藏在"发送反馈"mailto 链接里, 形如 [UG571] [2025-01-14] [1.16 English]
async function grabVersionFromViewer(page) {
  try {
    const info = await page.evaluate(() => {
      const a = [...document.querySelectorAll("a")].find((x) => (x.href || "").includes("doc_portal_feedback"));
      return a ? decodeURIComponent(a.href) : "";
    });
    const vm = info.match(/\[([\d.]+)\s*English\]/i);
    return vm ? "v" + vm[1] : null;
  } catch { return null; }
}

// 打开地址并监听网络请求, 截获 mapId / docId
async function openAndCapture(context, base, slug) {
  const page = await context.newPage();
  const cap = { mapId: null, docId: null };
  page.on("request", (req) => {
    const u = req.url();
    let m;
    if ((m = u.match(/\/api\/khub\/maps\/([^/?]+)/)) && !cap.mapId) cap.mapId = m[1];
    if ((m = u.match(/\/api\/khub\/documents\/([^/?]+)\/content/)) && !cap.docId) cap.docId = m[1];
    if ((m = u.match(/\/internal\/api\/webapp\/documents\/([^/?]+)$/)) && !cap.docId) cap.docId = m[1];
  });
  await page.goto(base + slug, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  try {
    for (const b of await page.$$("button")) {
      const t = (await b.textContent()) || "";
      if (/Accept|同意/i.test(t)) { await b.click().catch(() => {}); break; }
    }
  } catch {}
  for (let i = 0; i < 20 && !cap.mapId && !cap.docId; i++) {
    await page.waitForTimeout(1500);
    const t = await page.title().catch(() => "");
    if (/未找到|not found/i.test(t)) break; // 该系统里不存在此文档, 提前退出去试另一套
  }
  return { page, cap };
}

async function downloadOne(context, slug, outDir) {
  console.log(`\n[${slug}]`);
  let page = null, cap = null;
  for (const base of ["https://docs.amd.com/r/en-US/", "https://docs.amd.com/v/u/en-US/"]) {
    const r = await openAndCapture(context, base, slug);
    console.log(`  试 ${base}${slug}  ->  ${await r.page.title().catch(() => "")}`);
    if (r.cap.mapId || r.cap.docId) { page = r.page; cap = r.cap; break; }
    await r.page.close();
  }
  if (!cap || (!cap.mapId && !cap.docId)) {
    console.log("  ✗ 两套系统都没找到 (slug 可能不对)");
    return { slug, ok: false, reason: "not found" };
  }

  let contentUrl, version = null;
  if (cap.mapId) {
    console.log(`  [reader] mapId = ${cap.mapId}`);
    const listUrl = `https://docs.amd.com/api/khub/maps/${cap.mapId}/attachments`;
    const list = await page.evaluate(async (u) => (await fetch(u)).json(), listUrl);
    const pdf = Array.isArray(list) ? list.find((a) => a.mimeType === "application/pdf") : null;
    if (!pdf) { await page.close(); return { slug, ok: false, reason: "no pdf attachment" }; }
    const fm = String(pdf.file || "").match(/(\d{4}\.\d+)/);
    version = fm ? fm[1] : null;
    contentUrl = `${listUrl}/${pdf.id}/content`;
  } else {
    console.log(`  [viewer] docId = ${cap.docId}`);
    version = await grabVersionFromViewer(page);
    contentUrl = `https://docs.amd.com/api/khub/documents/${cap.docId}/content`;
  }
  console.log(`  版本=${version || "latest"}`);

  const resp = await context.request.get(contentUrl, { timeout: 300000, headers: { "User-Agent": UA } });
  const buf = await resp.body();
  if (buf.slice(0, 5).toString() !== "%PDF-") {
    console.log(`  ✗ 返回非 PDF (status=${resp.status()})`);
    await page.close();
    return { slug, ok: false, reason: "not pdf" };
  }
  fs.mkdirSync(outDir, { recursive: true });
  const outName = `${slug}${version ? "_" + version : ""}.pdf`;
  fs.writeFileSync(path.join(outDir, outName), buf);
  console.log(`  ✓ 保存 ${outName}  (${(buf.length / 1048576).toFixed(2)} MB)`);
  await page.close();
  return { slug, ok: true, version, size: buf.length, outName };
}

(async () => {
  const { outDir, slugs } = parseArgs(process.argv.slice(2));
  if (slugs.length === 0) {
    console.log("用法: node amd-doc-downloader.js [--out DIR] <slug> [<slug> ...]");
    console.log("示例: node amd-doc-downloader.js ug904-vivado-implementation");
    console.log("slug = docs.amd.com 文档页 URL 的最后一段");
    process.exit(1);
  }
  console.log(`输出目录: ${outDir}`);

  const browser = await launchBrowser();
  const context = await browser.newContext({ userAgent: UA });

  // 连通性预检
  try {
    const r = await context.request.get("https://docs.amd.com/", { timeout: 20000 });
    console.log(`连通性 OK: docs.amd.com -> HTTP ${r.status()}`);
  } catch (e) {
    console.log(`✗ 无法访问 docs.amd.com: ${e.message}`);
    await browser.close();
    process.exit(2);
  }

  const results = [];
  for (const slug of slugs) {
    try { results.push(await downloadOne(context, slug, outDir)); }
    catch (e) { console.log(`  ✗ ${slug} 异常: ${e.message}`); results.push({ slug, ok: false, reason: e.message }); }
  }
  await browser.close();

  console.log("\n===== 汇总 =====");
  for (const r of results) {
    if (r.ok) console.log(`✓ ${r.outName}  版本=${r.version || "latest"}  ${(r.size / 1048576).toFixed(2)}MB`);
    else console.log(`✗ ${r.slug}  原因=${r.reason || "?"}`);
  }
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
})();
