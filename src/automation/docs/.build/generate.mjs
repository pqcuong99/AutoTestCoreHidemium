import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { AlertCircle, ArrowLeft, ArrowRight, Camera, CheckSquare, Code2, Cookie, Copy, CornerDownLeft, Dices, Eraser, FileInput, FileOutput, FileText, Focus, GitBranch, Globe, Hand, Hash, Heading, Keyboard, Layers, Link2, ListChecks, ListOrdered, Loader, Monitor, MousePointer2, MousePointerClick, Move, MoveVertical, Navigation, OctagonX, Play, PlusSquare, Power, RefreshCw, Repeat, RotateCcw, RotateCw, Search, ShieldAlert, ShieldCheck, ShieldQuestion, SkipForward, Tag, Terminal, TextCursorInput, TextSearch, Timer, Trash2, Type, Upload, Variable, XSquare } from "lucide-react";
import { memo } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/automation/src/nodes/catalog.js
/**
* CATALOG NODE AUTOMATION.
*
* Moi node khai bao: type / label / icon / nhom / danh sach field cau hinh.
* Phan THUC THI nam o main process: src/main/automation/actions.js
* -> hai file phai dung CHUNG chuoi `type`. Them node moi thi them ca hai noi.
*
* field.kind: 'text' | 'number' | 'textarea' | 'select' | 'bool'
*/
/** Nhom node -> mau sac hien thi tren canvas va tren palette. */
var GROUPS = {
	browser: {
		label: "Browser",
		color: "#3b82f6"
	},
	action: {
		label: "Tuong tac",
		color: "#8b5cf6"
	},
	wait: {
		label: "Cho",
		color: "#f59e0b"
	},
	extract: {
		label: "Lay du lieu",
		color: "#10b981"
	},
	logic: {
		label: "Logic",
		color: "#f43f5e"
	},
	data: {
		label: "Du lieu",
		color: "#06b6d4"
	},
	assert: {
		label: "Kiem tra",
		color: "#f97316"
	},
	script: {
		label: "Script",
		color: "#64748b"
	}
};
/** Field dung lai nhieu lan. */
var selector = {
	key: "selector",
	label: "Selector (CSS / text=)",
	kind: "text",
	placeholder: "#login-btn"
};
var timeout = {
	key: "timeout",
	label: "Timeout (ms)",
	kind: "number",
	def: 3e4
};
var saveTo = {
	key: "saveTo",
	label: "Luu vao bien",
	kind: "text",
	placeholder: "myVar"
};
var NODES = [
	{
		type: "browser.open",
		group: "browser",
		icon: Play,
		label: "Mo profile",
		desc: "Mo profile Hidemium qua Local API roi noi Playwright vao (CDP)",
		fields: [{
			key: "uuid",
			label: "UUID profile (bo trong = lay tu danh sach chay)",
			kind: "text"
		}, timeout]
	},
	{
		type: "browser.close",
		group: "browser",
		icon: Power,
		label: "Dong profile",
		desc: "Dong profile Hidemium qua Local API",
		fields: []
	},
	{
		type: "browser.goto",
		group: "browser",
		icon: Globe,
		label: "Mo URL",
		desc: "Dieu huong tab hien tai toi URL",
		fields: [
			{
				key: "url",
				label: "URL",
				kind: "text",
				placeholder: "https://example.com"
			},
			{
				key: "waitUntil",
				label: "Cho den khi",
				kind: "select",
				options: [
					"load",
					"domcontentloaded",
					"networkidle"
				],
				def: "load"
			},
			timeout
		]
	},
	{
		type: "browser.reload",
		group: "browser",
		icon: RotateCw,
		label: "Tai lai trang",
		desc: "Reload tab hien tai",
		fields: [timeout]
	},
	{
		type: "browser.back",
		group: "browser",
		icon: ArrowLeft,
		label: "Quay lai",
		desc: "Lich su: lui 1 buoc",
		fields: []
	},
	{
		type: "browser.forward",
		group: "browser",
		icon: ArrowRight,
		label: "Tien toi",
		desc: "Lich su: tien 1 buoc",
		fields: []
	},
	{
		type: "browser.newTab",
		group: "browser",
		icon: PlusSquare,
		label: "Tab moi",
		desc: "Mo tab moi va chuyen sang tab do",
		fields: [{
			key: "url",
			label: "URL (tuy chon)",
			kind: "text"
		}]
	},
	{
		type: "browser.closeTab",
		group: "browser",
		icon: XSquare,
		label: "Dong tab",
		desc: "Dong tab dang chon",
		fields: []
	},
	{
		type: "browser.switchTab",
		group: "browser",
		icon: Layers,
		label: "Chuyen tab",
		desc: "Chuyen sang tab theo chi so (0 la tab dau)",
		fields: [{
			key: "index",
			label: "Chi so tab",
			kind: "number",
			def: 0
		}]
	},
	{
		type: "browser.setViewport",
		group: "browser",
		icon: Monitor,
		label: "Doi kich thuoc",
		desc: "Dat lai kich thuoc cua so trinh duyet",
		fields: [{
			key: "width",
			label: "Rong",
			kind: "number",
			def: 1280
		}, {
			key: "height",
			label: "Cao",
			kind: "number",
			def: 800
		}]
	},
	{
		type: "act.click",
		group: "action",
		icon: MousePointerClick,
		label: "Click",
		desc: "Click chuot trai vao phan tu",
		fields: [selector, timeout]
	},
	{
		type: "act.doubleClick",
		group: "action",
		icon: Copy,
		label: "Double click",
		desc: "Click dup",
		fields: [selector, timeout]
	},
	{
		type: "act.rightClick",
		group: "action",
		icon: MousePointer2,
		label: "Click phai",
		desc: "Mo menu chuot phai",
		fields: [selector, timeout]
	},
	{
		type: "act.type",
		group: "action",
		icon: Keyboard,
		label: "Go phim",
		desc: "Go tung ky tu (co do tre) - giong nguoi that",
		fields: [
			selector,
			{
				key: "text",
				label: "Noi dung",
				kind: "textarea"
			},
			{
				key: "delay",
				label: "Tre moi ky tu (ms)",
				kind: "number",
				def: 50
			},
			timeout
		]
	},
	{
		type: "act.fill",
		group: "action",
		icon: Type,
		label: "Dien nhanh",
		desc: "Dien thang gia tri vao o input (khong go tung phim)",
		fields: [
			selector,
			{
				key: "text",
				label: "Noi dung",
				kind: "textarea"
			},
			timeout
		]
	},
	{
		type: "act.press",
		group: "action",
		icon: CornerDownLeft,
		label: "Nhan phim",
		desc: "Nhan phim don hoac to hop (Enter, Control+A...)",
		fields: [
			selector,
			{
				key: "key",
				label: "Phim",
				kind: "text",
				placeholder: "Enter",
				def: "Enter"
			},
			timeout
		]
	},
	{
		type: "act.hover",
		group: "action",
		icon: Hand,
		label: "Hover",
		desc: "Di chuot len phan tu",
		fields: [selector, timeout]
	},
	{
		type: "act.scroll",
		group: "action",
		icon: MoveVertical,
		label: "Cuon trang",
		desc: "Cuon theo so pixel, hoac cuon toi phan tu neu co selector",
		fields: [{
			key: "selector",
			label: "Selector (bo trong = cuon ca trang)",
			kind: "text"
		}, {
			key: "y",
			label: "So pixel doc",
			kind: "number",
			def: 500
		}]
	},
	{
		type: "act.select",
		group: "action",
		icon: ListChecks,
		label: "Chon dropdown",
		desc: "Chon option trong the <select>",
		fields: [
			selector,
			{
				key: "value",
				label: "Gia tri option",
				kind: "text"
			},
			timeout
		]
	},
	{
		type: "act.check",
		group: "action",
		icon: CheckSquare,
		label: "Tick checkbox",
		desc: "Tick hoac bo tick checkbox / radio",
		fields: [
			selector,
			{
				key: "checked",
				label: "Tick vao",
				kind: "bool",
				def: true
			},
			timeout
		]
	},
	{
		type: "act.upload",
		group: "action",
		icon: Upload,
		label: "Upload file",
		desc: "Chon file cho o input type=file",
		fields: [
			selector,
			{
				key: "filePath",
				label: "Duong dan file",
				kind: "text"
			},
			timeout
		]
	},
	{
		type: "act.dragDrop",
		group: "action",
		icon: Move,
		label: "Keo tha",
		desc: "Keo phan tu nguon tha vao phan tu dich",
		fields: [
			{
				key: "selector",
				label: "Selector nguon",
				kind: "text"
			},
			{
				key: "target",
				label: "Selector dich",
				kind: "text"
			},
			timeout
		]
	},
	{
		type: "act.focus",
		group: "action",
		icon: Focus,
		label: "Focus",
		desc: "Dat con tro vao phan tu",
		fields: [selector, timeout]
	},
	{
		type: "act.clear",
		group: "action",
		icon: Eraser,
		label: "Xoa noi dung",
		desc: "Xoa sach o input",
		fields: [selector, timeout]
	},
	{
		type: "wait.time",
		group: "wait",
		icon: Timer,
		label: "Cho (giay)",
		desc: "Dung lai mot khoang thoi gian co dinh",
		fields: [{
			key: "ms",
			label: "Thoi gian (ms)",
			kind: "number",
			def: 1e3
		}]
	},
	{
		type: "wait.selector",
		group: "wait",
		icon: Search,
		label: "Cho phan tu",
		desc: "Cho den khi phan tu xuat hien / bien mat",
		fields: [
			selector,
			{
				key: "state",
				label: "Trang thai",
				kind: "select",
				options: [
					"visible",
					"hidden",
					"attached",
					"detached"
				],
				def: "visible"
			},
			timeout
		]
	},
	{
		type: "wait.navigation",
		group: "wait",
		icon: Navigation,
		label: "Cho chuyen trang",
		desc: "Cho dieu huong hoan tat",
		fields: [timeout]
	},
	{
		type: "wait.text",
		group: "wait",
		icon: TextSearch,
		label: "Cho van ban",
		desc: "Cho den khi trang chua doan van ban",
		fields: [{
			key: "text",
			label: "Van ban",
			kind: "text"
		}, timeout]
	},
	{
		type: "wait.load",
		group: "wait",
		icon: Loader,
		label: "Cho tai xong",
		desc: "Cho trang o trang thai load / networkidle",
		fields: [{
			key: "state",
			label: "Trang thai",
			kind: "select",
			options: [
				"load",
				"domcontentloaded",
				"networkidle"
			],
			def: "networkidle"
		}, timeout]
	},
	{
		type: "get.text",
		group: "extract",
		icon: FileText,
		label: "Lay van ban",
		desc: "Doc textContent cua phan tu",
		fields: [
			selector,
			saveTo,
			timeout
		]
	},
	{
		type: "get.attribute",
		group: "extract",
		icon: Tag,
		label: "Lay thuoc tinh",
		desc: "Doc gia tri thuoc tinh (href, src, class...)",
		fields: [
			selector,
			{
				key: "attr",
				label: "Ten thuoc tinh",
				kind: "text",
				placeholder: "href"
			},
			saveTo,
			timeout
		]
	},
	{
		type: "get.value",
		group: "extract",
		icon: TextCursorInput,
		label: "Lay gia tri input",
		desc: "Doc value cua o input",
		fields: [
			selector,
			saveTo,
			timeout
		]
	},
	{
		type: "get.url",
		group: "extract",
		icon: Link2,
		label: "Lay URL",
		desc: "URL cua tab hien tai",
		fields: [saveTo]
	},
	{
		type: "get.title",
		group: "extract",
		icon: Heading,
		label: "Lay tieu de",
		desc: "Tieu de trang",
		fields: [saveTo]
	},
	{
		type: "get.count",
		group: "extract",
		icon: Hash,
		label: "Dem phan tu",
		desc: "Dem so phan tu khop selector",
		fields: [selector, saveTo]
	},
	{
		type: "get.screenshot",
		group: "extract",
		icon: Camera,
		label: "Chup man hinh",
		desc: "Luu anh man hinh ra file",
		fields: [{
			key: "filePath",
			label: "Duong dan luu (.png)",
			kind: "text"
		}, {
			key: "fullPage",
			label: "Chup ca trang",
			kind: "bool",
			def: false
		}]
	},
	{
		type: "get.cookies",
		group: "extract",
		icon: Cookie,
		label: "Lay cookie",
		desc: "Doc toan bo cookie cua context",
		fields: [saveTo]
	},
	{
		type: "logic.if",
		group: "logic",
		icon: GitBranch,
		label: "Neu / Nguoc lai",
		desc: "Re nhanh theo dieu kien. Co 2 cong ra: Dung va Sai",
		branches: ["true", "false"],
		fields: [
			{
				key: "mode",
				label: "Kieu dieu kien",
				kind: "select",
				options: [
					"selectorExists",
					"selectorVisible",
					"textContains",
					"varEquals",
					"expression"
				],
				def: "selectorExists"
			},
			{
				key: "selector",
				label: "Selector / Bien",
				kind: "text"
			},
			{
				key: "value",
				label: "Gia tri so sanh",
				kind: "text"
			},
			timeout
		]
	},
	{
		type: "logic.loop",
		group: "logic",
		icon: Repeat,
		label: "Lap N lan",
		desc: "Chay nhanh \"Moi vong\" dung N lan roi di tiep",
		branches: ["loop", "done"],
		fields: [{
			key: "times",
			label: "So lan lap",
			kind: "number",
			def: 3
		}]
	},
	{
		type: "logic.forEach",
		group: "logic",
		icon: ListOrdered,
		label: "Lap theo phan tu",
		desc: "Lap qua tung phan tu khop selector",
		branches: ["loop", "done"],
		fields: [selector, {
			key: "itemVar",
			label: "Bien phan tu",
			kind: "text",
			def: "item"
		}]
	},
	{
		type: "logic.while",
		group: "logic",
		icon: RefreshCw,
		label: "Lap khi con dung",
		desc: "Lap chung nao dieu kien con dung (co gioi han vong)",
		branches: ["loop", "done"],
		fields: [
			{
				key: "mode",
				label: "Kieu dieu kien",
				kind: "select",
				options: [
					"selectorExists",
					"selectorVisible",
					"varEquals"
				],
				def: "selectorExists"
			},
			{
				key: "selector",
				label: "Selector / Bien",
				kind: "text"
			},
			{
				key: "value",
				label: "Gia tri so sanh",
				kind: "text"
			},
			{
				key: "maxLoops",
				label: "Gioi han vong lap",
				kind: "number",
				def: 50
			}
		]
	},
	{
		type: "logic.break",
		group: "logic",
		icon: SkipForward,
		label: "Thoat vong lap",
		desc: "Nhay ra khoi vong lap gan nhat",
		fields: []
	},
	{
		type: "logic.stop",
		group: "logic",
		icon: OctagonX,
		label: "Dung kich ban",
		desc: "Ket thuc toan bo kich ban ngay lap tuc",
		fields: [{
			key: "reason",
			label: "Ly do",
			kind: "text"
		}]
	},
	{
		type: "data.setVar",
		group: "data",
		icon: Variable,
		label: "Gan bien",
		desc: "Tao / doi gia tri mot bien. Dung {{ten}} de chen vao node khac",
		fields: [{
			key: "name",
			label: "Ten bien",
			kind: "text"
		}, {
			key: "value",
			label: "Gia tri",
			kind: "textarea"
		}]
	},
	{
		type: "data.random",
		group: "data",
		icon: Dices,
		label: "Ngau nhien",
		desc: "Sinh so / chuoi ngau nhien",
		fields: [
			{
				key: "kind",
				label: "Kieu",
				kind: "select",
				options: [
					"number",
					"string",
					"email"
				],
				def: "number"
			},
			{
				key: "min",
				label: "Nho nhat / Do dai",
				kind: "number",
				def: 1
			},
			{
				key: "max",
				label: "Lon nhat",
				kind: "number",
				def: 100
			},
			saveTo
		]
	},
	{
		type: "data.readFile",
		group: "data",
		icon: FileInput,
		label: "Doc file",
		desc: "Doc noi dung file text vao bien",
		fields: [{
			key: "filePath",
			label: "Duong dan file",
			kind: "text"
		}, saveTo]
	},
	{
		type: "data.writeFile",
		group: "data",
		icon: FileOutput,
		label: "Ghi file",
		desc: "Ghi / noi them noi dung vao file",
		fields: [
			{
				key: "filePath",
				label: "Duong dan file",
				kind: "text"
			},
			{
				key: "content",
				label: "Noi dung",
				kind: "textarea"
			},
			{
				key: "append",
				label: "Noi them vao cuoi",
				kind: "bool",
				def: true
			}
		]
	},
	{
		type: "data.log",
		group: "data",
		icon: Terminal,
		label: "Ghi log",
		desc: "In mot dong ra khung log khi chay",
		fields: [{
			key: "message",
			label: "Noi dung",
			kind: "textarea"
		}]
	},
	{
		type: "assert.exists",
		group: "assert",
		icon: ShieldCheck,
		label: "Kiem tra ton tai",
		desc: "That bai neu phan tu khong xuat hien",
		fields: [selector, timeout]
	},
	{
		type: "assert.text",
		group: "assert",
		icon: ShieldAlert,
		label: "Kiem tra van ban",
		desc: "That bai neu van ban khong khop",
		fields: [
			selector,
			{
				key: "value",
				label: "Van ban mong doi",
				kind: "text"
			},
			timeout
		]
	},
	{
		type: "assert.url",
		group: "assert",
		icon: ShieldQuestion,
		label: "Kiem tra URL",
		desc: "That bai neu URL khong chua doan nay",
		fields: [{
			key: "value",
			label: "URL mong doi (chua)",
			kind: "text"
		}]
	},
	{
		type: "script.js",
		group: "script",
		icon: Code2,
		label: "Chay JavaScript",
		desc: "Chay doan JS trong trang, ket qua tra ve luu vao bien",
		fields: [{
			key: "code",
			label: "Ma JavaScript",
			kind: "textarea",
			placeholder: "return document.title;"
		}, saveTo]
	}
];
/** Tra cuu nhanh theo type. */
var NODE_MAP = Object.fromEntries(NODES.map((n) => [n.type, n]));
//#endregion
//#region src/automation/src/nodes/AutoNode.jsx
/**
* Node automation ve tren canvas.
*
* Bo cuc:
*   [dau vao] ─┬ tieu de + icon + nut Start / Delete
*              ├ dong cong ra 1   (o)
*              ├ dong cong ra 2   (o)
*              └ dong cong "Loi"  (o)
*
* MOI cong ra la mot DONG rieng, handle neo vao chinh dong do
* -> khong con canh lech nhu khi dat `top` cung.
*
* Node thuong co 1 cong ra "Tiep". Node re nhanh co nhieu cong (Dung/Sai, Moi vong/Xong).
* Moi node deu co them cong "Loi": chay loi thi di theo day nay thay vi dung han.
*/
/** Ten hien thi + mau cua tung loai cong ra. */
var PORTS = {
	next: {
		label: "Tiep theo",
		color: "#34d399"
	},
	true: {
		label: "Dung",
		color: "#34d399"
	},
	false: {
		label: "Sai",
		color: "#fbbf24"
	},
	loop: {
		label: "Moi vong",
		color: "#a78bfa"
	},
	done: {
		label: "Xong",
		color: "#38bdf8"
	},
	error: {
		label: "Loi",
		color: "#f87171"
	}
};
/** Mau dau vao. */
var IN_COLOR = "#60a5fa";
/** Node lap can them dau vao rieng o duoi de nhan day quay nguoc ve. */
var LOOP_TYPES$1 = /* @__PURE__ */ new Set([
	"logic.loop",
	"logic.forEach",
	"logic.while"
]);
function AutoNode({ id, data, selected }) {
	const { setNodes, setEdges } = useReactFlow();
	const def = NODE_MAP[data.type];
	if (!def) return /* @__PURE__ */ jsxs("div", {
		className: "auto-node auto-node--unknown",
		children: [/* @__PURE__ */ jsx(AlertCircle, { size: 16 }), /* @__PURE__ */ jsxs("span", { children: ["Node khong ro: ", data.type] })]
	});
	const color = GROUPS[def.group]?.color || "#64748b";
	const Icon = def.icon;
	const outs = [...def.branches || ["next"], "error"];
	const isLoop = LOOP_TYPES$1.has(def.type);
	const onDelete = (e) => {
		e.stopPropagation();
		setNodes((ns) => ns.filter((n) => n.id !== id));
		setEdges((es) => es.filter((ed) => ed.source !== id && ed.target !== id));
	};
	const onStart = (e) => {
		e.stopPropagation();
		data.onRunFrom?.(id);
	};
	return /* @__PURE__ */ jsxs("div", {
		className: `auto-node ${selected ? "is-selected" : ""} ${data.status ? "is-" + data.status : ""}`,
		style: { "--node-color": color },
		children: [
			/* @__PURE__ */ jsx(Handle, {
				type: "target",
				position: Position.Left,
				className: "auto-handle auto-handle--in",
				style: { "--h": IN_COLOR }
			}),
			/* @__PURE__ */ jsx("div", { className: "auto-node__bar" }),
			/* @__PURE__ */ jsxs("div", {
				className: "auto-node__body",
				children: [
					/* @__PURE__ */ jsx("span", {
						className: "auto-node__icon",
						children: /* @__PURE__ */ jsx(Icon, { size: 16 })
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "auto-node__text",
						children: [/* @__PURE__ */ jsx("div", {
							className: "auto-node__label",
							children: data.label || def.label
						}), /* @__PURE__ */ jsx("div", {
							className: "auto-node__sub",
							children: summarize(def, data.params)
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "auto-node__tools",
						children: [/* @__PURE__ */ jsx("button", {
							className: "auto-icon-btn",
							title: "Chay tu node nay",
							onClick: onStart,
							children: /* @__PURE__ */ jsx(Play, { size: 13 })
						}), /* @__PURE__ */ jsx("button", {
							className: "auto-icon-btn auto-icon-btn--danger",
							title: "Xoa node",
							onClick: onDelete,
							children: /* @__PURE__ */ jsx(Trash2, { size: 13 })
						})]
					})
				]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "auto-node__ports",
				children: outs.map((key) => {
					const port = PORTS[key];
					return /* @__PURE__ */ jsxs("div", {
						className: `auto-port auto-port--${key}`,
						style: { "--h": port.color },
						children: [/* @__PURE__ */ jsx("span", {
							className: "auto-port__label",
							children: port.label
						}), /* @__PURE__ */ jsx(Handle, {
							id: key,
							type: "source",
							position: Position.Right,
							className: "auto-handle auto-handle--out",
							style: { "--h": port.color }
						})]
					}, key);
				})
			}),
			isLoop && /* @__PURE__ */ jsxs("div", {
				className: "auto-loopback",
				title: "Noi node cuoi cua than vong lap quay ve day",
				children: [
					/* @__PURE__ */ jsx(RotateCcw, { size: 11 }),
					/* @__PURE__ */ jsx("span", { children: "Quay lai vong lap" }),
					/* @__PURE__ */ jsx(Handle, {
						id: "back",
						type: "target",
						position: Position.Bottom,
						className: "auto-handle auto-handle--back",
						style: { "--h": PORTS.loop.color }
					})
				]
			})
		]
	});
}
/** Dong mo ta ngan duoi ten node: lay field dau tien co gia tri. */
function summarize(def, params = {}) {
	for (const f of def.fields) {
		const v = params[f.key];
		if (v === void 0 || v === "" || v === null) continue;
		const text = String(v);
		return text.length > 34 ? text.slice(0, 34) + "..." : text;
	}
	return def.desc.length > 38 ? def.desc.slice(0, 38) + "..." : def.desc;
}
memo(AutoNode);
//#endregion
//#region src/automation/docs/generate.jsx
/**
* SINH TAI LIEU HUONG DAN NODE.
*
* Doc thang tu catalog.js (cung nguon voi app) roi render ra HTML tinh
* -> them node moi vao catalog, chay lai lenh nay la tai lieu tu cap nhat,
*    khong bao gio lech voi app.
*
* Chay: npm run docs:nodes
* Ket qua:
*   src/automation/docs/huong-dan-node.html   (mo trong app, full HTML)
*   src/automation/docs/noi-dung.html         (chi phan noi dung, de dang len web)
*/
var OUT_DIR = path.resolve(process.cwd(), "src", "automation", "docs");
var esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\"": "&quot;"
})[c]);
var icon = (Cmp, size = 18) => renderToStaticMarkup(/* @__PURE__ */ jsx(Cmp, { size }));
var KIND_LABEL = {
	text: "chu",
	number: "so",
	textarea: "doan van",
	select: "chon san",
	bool: "bat/tat"
};
var LOOP_TYPES = /* @__PURE__ */ new Set([
	"logic.loop",
	"logic.forEach",
	"logic.while"
]);
var INTRO = `
<section class="box">
  <h2>Bat dau nhanh</h2>
  <ol class="steps">
    <li><b>Mo man Automation</b> - bam nut <i>Automation</i> tren thanh cong cu cua app.</li>
    <li><b>Tao kich ban</b> - bam nut <i>Tao kich ban</i> o dashboard.</li>
    <li><b>Keo node</b> tu cot trai tha vao khung giua.</li>
    <li><b>Noi cac node</b> - keo tu cong ra ben phai cua node truoc sang dau vao ben trai cua node sau.</li>
    <li><b>Sua tham so</b> - bam vao node, cot phai hien form nhap.</li>
    <li><b>Luu</b> roi bam <i>Chay</i>. Log hien o khung duoi cung.</li>
  </ol>
  <p class="note">
    Kich ban gan nhu luon bat dau bang node <b>Mo profile</b> - node do mo profile Hidemium
    va noi Playwright vao, cac node sau moi co trinh duyet de lam viec.
  </p>
</section>

<section class="box">
  <h2>Nut tren node va tren day noi</h2>
  <ul class="bullets">
    <li><b>Nut Start</b> (hinh tam giac tren node) - chay kich ban bat dau tu chinh node do, tien cho viec thu tung doan.</li>
    <li><b>Nut Delete</b> (hinh thung rac tren node) - xoa node, cac day noi vao no bi xoa theo.</li>
    <li><b>Nut x do</b> giua day noi - xoa day noi do.</li>
    <li><b>Xoa canvas</b> tren thanh cong cu - xoa toan bo node dang co.</li>
  </ul>
</section>

<section class="box">
  <h2>Bien - lay ket qua cua node truoc dung cho node sau</h2>
  <p>
    Node co o <b>Luu vao bien</b> se cat ket qua lai. Muon dung lai o node khac thi viet
    <code>{{tenBien}}</code> trong o nhap - luc chay he thong tu thay bang gia tri that.
  </p>
  <div class="example">
    <div class="example__row"><span class="chip">1</span> <b>Lay van ban</b> &middot; selector <code>.price</code> &middot; luu vao bien <code>gia</code></div>
    <div class="example__row"><span class="chip">2</span> <b>Ghi log</b> &middot; noi dung <code>Gia hien tai: {{gia}}</code></div>
  </div>
  <p class="note">
    Bien co san: <code>{{lastError}}</code> - thong bao loi cua node vua that bai (dung o nhanh Loi).
  </p>
</section>
`;
var RECIPES = `
<section class="box">
  <h2>Vai kich ban mau</h2>

  <h3>1. Dang nhap mot trang web</h3>
  <div class="example">
    <div class="example__row"><span class="chip">1</span> <b>Mo profile</b></div>
    <div class="example__row"><span class="chip">2</span> <b>Mo URL</b> &middot; <code>https://trangweb.com/login</code></div>
    <div class="example__row"><span class="chip">3</span> <b>Cho phan tu</b> &middot; <code>#username</code></div>
    <div class="example__row"><span class="chip">4</span> <b>Go phim</b> &middot; <code>#username</code> &middot; ten dang nhap</div>
    <div class="example__row"><span class="chip">5</span> <b>Go phim</b> &middot; <code>#password</code> &middot; mat khau</div>
    <div class="example__row"><span class="chip">6</span> <b>Click</b> &middot; <code>button[type=submit]</code></div>
    <div class="example__row"><span class="chip">7</span> <b>Cho chuyen trang</b></div>
    <div class="example__row"><span class="chip">8</span> <b>Kiem tra URL</b> &middot; chua <code>/dashboard</code></div>
  </div>

  <h3>2. Lap qua danh sach san pham va ghi ra file</h3>
  <div class="example">
    <div class="example__row"><span class="chip">1</span> <b>Mo profile</b> &rarr; <b>Mo URL</b></div>
    <div class="example__row"><span class="chip">2</span> <b>Lap theo phan tu</b> &middot; <code>.product-item</code> &middot; bien <code>item</code></div>
    <div class="example__row example__row--in"><span class="chip chip--loop">Moi vong</span> <b>Ghi file</b> &middot; noi dung <code>{{item}}</code></div>
    <div class="example__row example__row--in"><span class="chip chip--loop">&crarr;</span> noi nguoc ve dau vao <i>Quay lai vong lap</i> cua node lap</div>
    <div class="example__row"><span class="chip chip--done">Xong</span> <b>Ghi log</b> &middot; <code>Da lay xong</code></div>
  </div>

  <h3>3. Bo qua popup neu co</h3>
  <div class="example">
    <div class="example__row"><span class="chip">1</span> <b>Neu / Nguoc lai</b> &middot; kieu <code>selectorVisible</code> &middot; <code>.popup-close</code></div>
    <div class="example__row example__row--in"><span class="chip chip--true">Dung</span> <b>Click</b> &middot; <code>.popup-close</code> &rarr; node tiep theo</div>
    <div class="example__row example__row--in"><span class="chip chip--false">Sai</span> di thang toi node tiep theo</div>
  </div>

  <h3>4. Bat loi de kich ban khong chet giua chung</h3>
  <div class="example">
    <div class="example__row"><span class="chip">1</span> <b>Click</b> &middot; <code>#nut-co-the-khong-co</code></div>
    <div class="example__row example__row--in"><span class="chip chip--error">Loi</span> <b>Ghi log</b> &middot; <code>Bo qua: {{lastError}}</code> &rarr; chay tiep</div>
  </div>
</section>
`;
function portsSection() {
	const row = (key, when) => {
		const p = PORTS[key];
		return `<tr>
      <td><span class="port-dot" style="--c:${p.color}"></span> <b>${esc(p.label)}</b></td>
      <td><code>${esc(key)}</code></td>
      <td>${when}</td>
    </tr>`;
	};
	return `
<section class="box">
  <h2>Dau noi tren node</h2>
  <p>
    Ben trai node la <b>dau vao</b> (<span class="port-dot" style="--c:${IN_COLOR}"></span> mau xanh duong).
    Ben phai la cac <b>cong ra</b>, moi cong mot dong co mau rieng.
    Day noi mang mau cua cong ma no xuat phat, nhin la biet dang o nhanh nao.
  </p>
  <div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Cong</th><th>Ma</th><th>Khi nao di theo cong nay</th></tr></thead>
    <tbody>
      ${row("next", "Node chay xong binh thuong. Node thuong chi co cong nay.")}
      ${row("true", "Dieu kien cua node <i>Neu / Nguoc lai</i> dung.")}
      ${row("false", "Dieu kien cua node <i>Neu / Nguoc lai</i> sai.")}
      ${row("loop", "Di vao than vong lap - chay mot lan cho moi vong.")}
      ${row("done", "Vong lap da chay het - di tiep phan sau.")}
      ${row("error", "Node that bai. <b>Node nao cung co cong nay.</b>")}
    </tbody>
  </table></div>

  <h3>Cong Loi</h3>
  <p>
    Neu ban keo mot day tu cong <b>Loi</b>, khi node do that bai kich ban se di theo day do
    thay vi dung han, va thong bao loi duoc luu vao <code>{{lastError}}</code>.
    Khong noi gi vao cong Loi thi node that bai se dung ca kich ban.
  </p>

  <h3>Node lap</h3>
  <p>
    Ba node <b>Lap N lan</b>, <b>Lap theo phan tu</b>, <b>Lap khi con dung</b> co them mot dau vao
    <b>Quay lai vong lap</b> o canh duoi. Cach noi mot vong hoan chinh:
  </p>
  <ol class="steps">
    <li>Cong <b>Moi vong</b> &rarr; node dau tien cua than vong lap.</li>
    <li>Node cuoi cua than vong lap &rarr; dau vao <b>Quay lai vong lap</b> o day node lap.</li>
    <li>Cong <b>Xong</b> &rarr; phan chay tiep sau khi lap het.</li>
  </ol>
  <p class="note">
    Kich ban co gioi han 10.000 buoc. Noi sai thanh vong vo tan thi no tu dung va bao loi,
    khong lam treo app. Rieng <i>Lap khi con dung</i> con co them o <i>Gioi han vong lap</i>.
  </p>
</section>`;
}
function nodeCard(n) {
	const g = GROUPS[n.group];
	const fields = n.fields.length ? `<div class="node__fields tbl-wrap">
        <table class="tbl tbl--fields">
          <thead><tr><th>O nhap</th><th>Kieu</th><th>Mac dinh</th></tr></thead>
          <tbody>${n.fields.map((f) => `
            <tr>
              <td>${esc(f.label)}</td>
              <td><span class="kind">${esc(KIND_LABEL[f.kind] || "chu")}</span>${f.options ? " " + f.options.map((o) => `<code>${esc(o)}</code>`).join(" ") : ""}</td>
              <td>${f.def !== void 0 ? `<code>${esc(f.def)}</code>` : "<span class=\"dim\">-</span>"}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>` : "<p class=\"node__none\">Node nay khong can nhap gi.</p>";
	const ports = [...n.branches || ["next"], "error"].map((k) => `
      <div class="node__port node__port--${k}" style="--c:${PORTS[k].color}">
        <span class="node__port-label">${esc(PORTS[k].label)}</span>
        <span class="port-dot"></span>
      </div>`).join("");
	const loopBack = LOOP_TYPES.has(n.type) ? `<div class="node__port node__port--in" style="--c:${PORTS.loop.color}">
         <span class="node__port-label">&darr; dau vao: Quay lai vong lap</span>
         <span class="port-dot"></span>
       </div>` : "";
	return `
<article class="node" id="${esc(n.type)}" style="--c:${g.color}">
  <div class="node__bar"></div>
  <header class="node__head">
    <span class="node__icon">${icon(n.icon)}</span>
    <div class="node__name">
      <h3>${esc(n.label)}</h3>
      <span class="node__type">${esc(n.type)}</span>
    </div>
  </header>
  <p class="node__desc">${esc(n.desc)}</p>
  <div class="node__ports">${ports}${loopBack}</div>
  ${fields}
</article>`;
}
function groupSection(key) {
	const g = GROUPS[key];
	const items = NODES.filter((n) => n.group === key);
	return `
<section class="group" id="nhom-${key}">
  <h2 class="group__title" style="--c:${g.color}">
    <span class="group__dot"></span>${esc(g.label)}
    <span class="group__count">${items.length} node</span>
  </h2>
  <div class="group__grid">${items.map(nodeCard).join("")}</div>
</section>`;
}
var CSS = fs.readFileSync(path.join(OUT_DIR, "docs.css"), "utf8");
var nav = Object.entries(GROUPS).map(([k, g]) => `<a href="#nhom-${k}" style="--c:${g.color}"><span class="nav__dot"></span>${esc(g.label)}
    <span class="nav__n">${NODES.filter((n) => n.group === k).length}</span></a>`).join("");
var CONTENT = `
<header class="top">
  <h1>Huong dan node Automation</h1>
  <p class="top__sub">
    Tai lieu su dung man flow keo tha cua Auto Test Core Hidemium &mdash;
    ${NODES.length} node, ${Object.keys(GROUPS).length} nhom.
  </p>
</header>

<nav class="nav">${nav}</nav>

${INTRO}
${portsSection()}
${RECIPES}

<h2 class="section-title">Danh sach day du ${NODES.length} node</h2>
<div class="search-wrap">
  <input id="q" class="search" type="text" placeholder="Go de tim node theo ten hoac ma..." />
  <span id="q-count" class="search__count"></span>
</div>

${Object.keys(GROUPS).map(groupSection).join("")}

<footer class="foot">
  Tai lieu nay duoc sinh tu <code>src/automation/src/nodes/catalog.js</code>.
  Them node moi thi chay lai <code>npm run docs:nodes</code> de cap nhat.
</footer>

<script>
  // Tim kiem tai cho: an node khong khop, an luon nhom rong.
  (function () {
    var q = document.getElementById('q');
    var count = document.getElementById('q-count');
    var nodes = [].slice.call(document.querySelectorAll('.node'));
    var groups = [].slice.call(document.querySelectorAll('.group'));
    if (!q) return;
    q.addEventListener('input', function () {
      var k = q.value.trim().toLowerCase();
      var shown = 0;
      nodes.forEach(function (n) {
        var hit = !k || n.textContent.toLowerCase().indexOf(k) >= 0;
        n.style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
      groups.forEach(function (g) {
        var any = g.querySelectorAll('.node:not([style*="none"])').length;
        g.style.display = any ? '' : 'none';
      });
      count.textContent = k ? shown + ' node khop' : '';
    });
  })();
<\/script>`;
fs.writeFileSync(path.join(OUT_DIR, "huong-dan-node.html"), `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Huong dan node Automation</title>
<style>${CSS}</style>
</head>
<body><main class="page">${CONTENT}</main></body>
</html>`, "utf8");
fs.writeFileSync(path.join(OUT_DIR, "noi-dung.html"), `<title>Huong dan node Automation</title>\n<style>${CSS}</style>\n<main class="page">${CONTENT}</main>`, "utf8");
console.log(`Da sinh tai lieu cho ${NODES.length} node.`);
//#endregion
export {};
