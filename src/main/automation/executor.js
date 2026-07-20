/**
 * EXECUTOR - chay do thi node lan luot.
 *
 * Cach di:
 *   1. Tim node bat dau (do nguoi dung chi dinh, hoac node khong co day noi vao).
 *   2. Chay node -> hoi node tra ve cong ra nao -> di theo day noi cua cong do.
 *   3. Lap lai den khi het day noi, gap node "Dung kich ban", hoac bam Dung.
 *
 * Node re nhanh / vong lap (logic.*) duoc xu ly ngay tai day chu khong o actions.js,
 * vi chung can biet cau truc do thi chu khong chi rieng trang web.
 *
 * Chan vong lap vo han bang MAX_STEPS - kich ban sai day khong treo ca app.
 */
const { ACTIONS, resolveParams, num } = require('./actions');

const MAX_STEPS = 10000;

class Executor {
  constructor() {
    this.running = false;
    this.controller = null;
  }

  isRunning() { return this.running; }

  stop() {
    const was = this.running;
    if (this.controller) this.controller.abort();
    return was;
  }

  /**
   * @param {{nodes:Array, edges:Array, startNodeId?:string}} flow
   * @param {object} options { apiBase, uuid }
   * @param {(evt:object)=>void} emit
   */
  async run(flow, options, emit) {
    if (this.running) throw new Error('Dang chay roi - bam Dung truoc da.');

    const nodes = flow.nodes || [];
    const edges = flow.edges || [];
    if (!nodes.length) throw new Error('Kich ban chua co node nao.');

    this.running = true;
    this.controller = new AbortController();
    const signal = this.controller.signal;

    const byId = new Map(nodes.map((n) => [n.id, n]));
    const nodeName = (n) => n?.data?.label || n?.data?.type || n?.id;

    const log = (message, kind, node) =>
      emit({ type: 'log', message, kind: kind || 'info', nodeLabel: node ? nodeName(node) : undefined });

    const setStatus = (nodeId, status) => emit({ type: 'node-status', nodeId, status });

    // ---- Ngu canh dung chung cho moi node ----
    const ctx = {
      page: null, context: null, browser: null,
      vars: {},
      options: options || {},
      signal,
      state: { uuid: options?.uuid || null, opened: false },
      setPage(p) { ctx.page = p; },
      log: (m, k) => log(m, k),
    };

    const start = this.pickStart(nodes, edges, flow.startNodeId);
    if (!start) throw new Error('Khong tim duoc node bat dau. Hay noi cac node thanh mot chuoi.');

    log(`Bat dau tu "${nodeName(start)}" (${nodes.length} node).`);

    const loopState = new Map(); // nodeId -> tien do vong lap
    const loopStack = [];        // cac vong lap dang mo, phuc vu node "Thoat vong lap"
    let current = start;
    let steps = 0;
    let error = null;

    try {
      while (current) {
        if (signal.aborted) throw new Error('aborted');
        if (++steps > MAX_STEPS) {
          throw new Error(`Vuot qua ${MAX_STEPS} buoc - co the kich ban bi lap vo han.`);
        }

        setStatus(current.id, 'running');
        let branch;

        try {
          branch = await this.runNode(current, ctx, { loopState, loopStack, log });
          setStatus(current.id, 'ok');
        } catch (err) {
          if (err.message === 'aborted' || signal.aborted) throw err;
          if (err.message === '__STOP__') {
            setStatus(current.id, 'ok');
            log('Kich ban dung theo yeu cau cua node.', 'warn');
            break;
          }

          setStatus(current.id, 'err');
          log(err.message, 'err', current);

          // Node co day noi tu cong "Loi" -> di theo huong do thay vi dung ca kich ban.
          const handler = edges.find((e) => e.source === current.id && e.sourceHandle === 'error');
          const target = handler && byId.get(handler.target);
          if (!target) throw err;

          ctx.vars.lastError = err.message;   // de node sau doc bang {{lastError}}
          log('Di tiep theo nhanh Loi.', 'warn', current);
          current = target;
          continue;
        }

        const next = this.nextNode(current.id, branch, edges, byId);
        if (!next) {
          log('Het day noi - ket thuc kich ban.', 'ok');
          break;
        }
        current = next;
      }
    } catch (err) {
      error = signal.aborted ? 'Da dung theo yeu cau.' : err.message;
    } finally {
      // Du thanh cong hay that bai deu phai don trinh duyet - khong bo profile mo coi.
      await this.cleanup(ctx, log);
      this.running = false;
      this.controller = null;
      emit({ type: 'finish', error });
    }

    return { ok: !error, error };
  }

  /** Chay mot node. Tra ve ten cong ra can di tiep (undefined = cong mac dinh). */
  async runNode(node, ctx, helpers) {
    const type = node.data?.type;
    const params = resolveParams(node.data?.params || {}, ctx.vars);
    const { loopState, loopStack, log } = helpers;

    switch (type) {
      // ---- Re nhanh ----
      case 'logic.if': {
        const ok = await evalCondition(ctx, params);
        log(`Dieu kien: ${ok ? 'Dung' : 'Sai'}`, 'info', node);
        return ok ? 'true' : 'false';
      }

      case 'logic.loop': {
        const times = num(params.times, 3);
        const done = loopState.get(node.id) || 0;
        if (done < times) {
          loopState.set(node.id, done + 1);
          if (done === 0) loopStack.push(node.id);
          log(`Vong lap ${done + 1}/${times}`, 'info', node);
          return 'loop';
        }
        loopState.delete(node.id);
        popLoop(loopStack, node.id);
        return 'done';
      }

      case 'logic.forEach': {
        if (!ctx.page) throw new Error('Chua co trinh duyet.');
        let st = loopState.get(node.id);
        if (!st) {
          const total = await ctx.page.locator(params.selector || '*').count();
          st = { i: 0, total };
          loopState.set(node.id, st);
          loopStack.push(node.id);
          log(`Tim thay ${total} phan tu.`, 'info', node);
        }
        if (st.i < st.total) {
          const varName = params.itemVar || 'item';
          const el = ctx.page.locator(params.selector).nth(st.i);
          ctx.vars[varName] = await el.innerText().catch(() => '');
          ctx.vars[varName + 'Index'] = st.i;
          st.i++;
          log(`Phan tu ${st.i}/${st.total}`, 'info', node);
          return 'loop';
        }
        loopState.delete(node.id);
        popLoop(loopStack, node.id);
        return 'done';
      }

      case 'logic.while': {
        const max = num(params.maxLoops, 50);
        const count = loopState.get(node.id) || 0;
        if (count >= max) {
          log(`Cham gioi han ${max} vong - thoat.`, 'warn', node);
          loopState.delete(node.id);
          popLoop(loopStack, node.id);
          return 'done';
        }
        const ok = await evalCondition(ctx, params);
        if (ok) {
          loopState.set(node.id, count + 1);
          if (count === 0) loopStack.push(node.id);
          return 'loop';
        }
        loopState.delete(node.id);
        popLoop(loopStack, node.id);
        return 'done';
      }

      case 'logic.break': {
        const loopId = loopStack[loopStack.length - 1];
        if (!loopId) {
          log('Khong o trong vong lap nao - bo qua.', 'warn', node);
          return undefined;
        }
        loopState.delete(loopId);
        loopStack.pop();
        log('Thoat vong lap.', 'info', node);
        // Bao cho vong lap biet phai di ra cong "Xong".
        return { jumpTo: loopId, branch: 'done' };
      }

      case 'logic.stop': {
        if (params.reason) log('Ly do: ' + params.reason, 'warn', node);
        throw new Error('__STOP__');
      }

      // ---- Node thuong ----
      default: {
        const fn = ACTIONS[type];
        if (!fn) throw new Error(`Chua ho tro node kieu "${type}".`);
        log('Chay...', 'info', node);
        const res = await fn(ctx, params);
        return res?.branch;
      }
    }
  }

  /** Tim node ke tiep theo cong ra. */
  nextNode(nodeId, branch, edges, byId) {
    // Node "Thoat vong lap" nhay thang toi cong "Xong" cua vong lap bao ngoai.
    if (branch && typeof branch === 'object' && branch.jumpTo) {
      return this.nextNode(branch.jumpTo, branch.branch, edges, byId);
    }

    const out = edges.filter((e) => e.source === nodeId);
    if (!out.length) return null;

    // Khong co branch = di cong mac dinh "Tiep theo".
    // Phai loai tru cong "Loi", neu khong node chi noi moi day Loi se chay nham vao do.
    const edge = branch
      ? out.find((e) => e.sourceHandle === branch)
      : out.find((e) => e.sourceHandle === 'next') ||
        out.find((e) => !e.sourceHandle) ||
        out.find((e) => e.sourceHandle !== 'error');

    return edge ? byId.get(edge.target) || null : null;
  }

  /** Node bat dau: do nguoi dung chon, hoac node khong co day noi vao. */
  pickStart(nodes, edges, startNodeId) {
    if (startNodeId) {
      const picked = nodes.find((n) => n.id === startNodeId);
      if (picked) return picked;
    }
    const hasIncoming = new Set(edges.map((e) => e.target));
    const roots = nodes.filter((n) => !hasIncoming.has(n.id));
    // Uu tien node mo profile de kich ban chac chan co trinh duyet.
    return roots.find((n) => n.data?.type === 'browser.open') || roots[0] || nodes[0];
  }

  /** Dong Playwright + dong profile Hidemium neu kich ban chua tu dong. */
  async cleanup(ctx, log) {
    try {
      if (ctx.browser) await ctx.browser.close().catch(() => {});
      if (ctx.state.opened && ctx.state.uuid) {
        const { closeProfile } = require('../hidemiumApi');
        await closeProfile(ctx.state.uuid, { baseUrl: ctx.options.apiBase });
        log('Da dong profile (don dep).', 'info');
      }
    } catch (err) {
      log('Don dep loi: ' + err.message, 'warn');
    }
  }
}

/** Bo mot vong lap ra khoi stack du no khong nam tren cung. */
function popLoop(stack, id) {
  const i = stack.lastIndexOf(id);
  if (i >= 0) stack.splice(i, 1);
}

/** Dieu kien dung chung cho logic.if va logic.while. */
async function evalCondition(ctx, p) {
  const mode = p.mode || 'selectorExists';

  if (mode === 'varEquals') {
    return String(ctx.vars[p.selector] ?? '') === String(p.value ?? '');
  }

  if (mode === 'expression') {
    // Chay trong trang, khong phai trong Node -> khong cham toi may nguoi dung.
    if (!ctx.page) throw new Error('Chua co trinh duyet.');
    return Boolean(await ctx.page.evaluate(`(() => { return (${p.value}); })()`));
  }

  if (!ctx.page) throw new Error('Chua co trinh duyet.');

  if (mode === 'textContains') {
    const body = await ctx.page.locator('body').innerText().catch(() => '');
    return body.includes(String(p.value ?? ''));
  }

  const loc = ctx.page.locator(p.selector || 'body').first();
  if (mode === 'selectorVisible') return await loc.isVisible().catch(() => false);
  return (await ctx.page.locator(p.selector || 'body').count()) > 0;
}

module.exports = new Executor();
