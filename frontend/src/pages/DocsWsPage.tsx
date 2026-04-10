import React, { useEffect, useRef, useState } from "react";
import { useAlert } from "../components/Alert";
import { socket } from "../socket/socket";

interface WsEvent {
	id: string;
	name: string;
	direction: "front-to-back" | "back-to-front";
	group: string;
	description: string;
	payload: string;
	payloadDescription: string;
	response: string;
	responseName: string;
	responseDescription: string;
}

interface WsLogEntry {
	id: string;
	direction: "incoming" | "outgoing" | "status";
	event: string;
	payload: string;
	time: string;
}

const BACKEND_URL = `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_PORT || "3000"}`;

function formatJson(str: string): string {
	try {
		return JSON.stringify(JSON.parse(str), null, 2);
	} catch {
		return str;
	}
}

function getTestPayloadSeed(payload: string): string {
	const trimmed = payload.trim();
	if (!trimmed) return "";

	try {
		return JSON.stringify(JSON.parse(trimmed), null, 2);
	} catch {
		const normalized = trimmed
			.replace(/:\s*string\b/g, ': ""')
			.replace(/:\s*boolean\b/g, ": false")
			.replace(/:\s*number\b/g, ": 0")
			.replace(/:\s*null\b/g, ": null")
			.replace(/:\s*object\b/g, ": {}")
			.replace(/:\s*array\b/g, ": []");

		try {
			return JSON.stringify(JSON.parse(normalized), null, 2);
		} catch {
			return trimmed;
		}
	}
}

function formatLogPayload(args: unknown[]): string {
	if (args.length === 0) return "";
	if (args.length === 1) return formatLogValue(args[0]);
	return formatLogValue(args);
}

function formatLogValue(value: unknown): string {
	if (typeof value === "undefined") return "";
	if (typeof value === "string") {
		try {
			return JSON.stringify(JSON.parse(value), null, 2);
		} catch {
			return "";
		}
	}
	if (value instanceof Error) return "";
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return "";
	}
}

function groupBy(events: WsEvent[]): [string, WsEvent[]][] {
	const map = new Map<string, WsEvent[]>();
	for (const e of events) {
		const key = e.group?.trim() || "Général";
		if (!map.has(key)) map.set(key, []);
		map.get(key)!.push(e);
	}
	return Array.from(map.entries());
}

const inputStyle: React.CSSProperties = {
	width: "100%",
	padding: "0.65rem 0.9rem",
	background: "rgba(0,0,0,0.45)",
	border: "1px solid var(--color-border)",
	borderRadius: "10px",
	color: "var(--color-text)",
	fontSize: "0.88rem",
	outline: "none",
	fontFamily: "var(--font-body)",
	transition: "border-color var(--transition-soft)",
};

const labelStyle: React.CSSProperties = {
	display: "block",
	fontSize: "0.76rem",
	fontWeight: 700,
	letterSpacing: "0.15em",
	textTransform: "uppercase",
	color: "var(--color-text-muted)",
	marginBottom: "0.5rem",
};

const passwordManagerIgnoreProps = {
	autoComplete: "off",
	"data-bwignore": "true",
} as const;

type TextareaField = "description" | "payloadDescription" | "responseDescription" | "payload" | "response";

function resizeTextarea(el: HTMLTextAreaElement, maxRows: number) {
	el.style.height = "auto";
	const styles = window.getComputedStyle(el);
	const fontSize = parseFloat(styles.fontSize) || 16;
	const parsedLineHeight = parseFloat(styles.lineHeight);
	const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : fontSize * 1.4;
	const padding = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
	const borders = (parseFloat(styles.borderTopWidth) || 0) + (parseFloat(styles.borderBottomWidth) || 0);
	const maxHeight = lineHeight * maxRows + padding + borders;
	const nextHeight = Math.min(el.scrollHeight, maxHeight);

	el.style.height = `${nextHeight}px`;
	el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
}

function selectAll(el: HTMLElement) {
	const selection = window.getSelection();
	if (!selection) return;
	const range = document.createRange();
	range.selectNodeContents(el);
	selection.removeAllRanges();
	selection.addRange(range);
}

function EventCard({ event, onEdit, onDelete, onTest }: {
	event: WsEvent;
	onEdit: (e: WsEvent) => void;
	onDelete: (id: string) => void;
	onTest: (e: WsEvent) => void;
}) {
	const isFtB = event.direction === "front-to-back";
	const accent = isFtB ? "var(--color-primary)" : "var(--color-secondary)";
	const accentSoft = isFtB ? "var(--color-primary-soft)" : "var(--color-secondary-soft)";
	const preColor = isFtB ? "var(--color-secondary)" : "var(--color-accent)";

	return (
		<div className="card" style={{ padding: "1.2rem", marginBottom: "0.75rem" }}>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
				<code
					style={{
						color: accent, fontSize: "0.82rem", letterSpacing: "0.04em",
						background: accentSoft, padding: "0.3rem 0.65rem",
						borderRadius: "8px", border: `1px solid ${accent}28`,
						userSelect: "text", WebkitUserSelect: "text", cursor: "text",
					}}
					onDoubleClick={(e) => selectAll(e.currentTarget)}
				>
					{event.name}
				</code>
				<div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
					{isFtB && (
						<button
							className="button"
							style={{
								minHeight: "30px", padding: "0 0.75rem", fontSize: "0.76rem",
								border: "1px solid rgba(61,231,255,0.22)",
								background: "rgba(61,231,255,0.12)", color: "var(--color-secondary)",
							}}
							onClick={() => onTest(event)}
						>
							Tester
						</button>
					)}
					<button
						className="button button-secondary"
						style={{ minHeight: "30px", padding: "0 0.75rem", fontSize: "0.76rem" }}
						onClick={() => onEdit(event)}
					>
						Modifier
					</button>
					<button
						className="button"
						style={{
							minHeight: "30px", padding: "0 0.75rem", fontSize: "0.76rem",
							border: "1px solid var(--color-border-strong)",
							background: "rgba(255,54,95,0.1)", color: "var(--color-primary)",
						}}
						onClick={() => onDelete(event.id)}
					>
						Supprimer
					</button>
				</div>
			</div>

			{event.description && (
				<p style={{ margin: "0.75rem 0 0", color: "var(--color-text-muted)", fontSize: "0.88rem", lineHeight: 1.55 }}>
					{event.description}
				</p>
			)}

			<div style={{ marginTop: "1rem" }}>
				<span style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>
					Payload
				</span>
				{event.payloadDescription && (
					<p style={{ margin: "0 0 0.5rem", color: "var(--color-text-muted)", fontSize: "0.82rem", lineHeight: 1.5 }}>
						{event.payloadDescription}
					</p>
				)}
				<pre
					style={{
						margin: 0, padding: "0.85rem 1rem",
						background: "rgba(0,0,0,0.35)", border: "1px solid var(--color-border)",
						borderRadius: "12px", fontSize: "0.78rem", color: "var(--color-secondary)",
						lineHeight: 1.65, overflowX: "auto", fontFamily: "monospace",
						userSelect: "text", WebkitUserSelect: "text", cursor: "text",
					}}
					onDoubleClick={(e) => selectAll(e.currentTarget)}
				>
					{formatJson(event.payload)}
				</pre>
			</div>

			{event.responseName && (
				<div style={{ marginTop: "0.85rem" }}>
					<code style={{
						display: "inline-block", marginBottom: "0.5rem",
						color: preColor, fontSize: "0.82rem", letterSpacing: "0.04em",
						background: isFtB ? "var(--color-secondary-soft)" : "var(--color-accent-soft)",
						padding: "0.3rem 0.65rem", borderRadius: "8px",
						border: `1px solid ${preColor}28`,
						userSelect: "text", WebkitUserSelect: "text", cursor: "text",
					}}
					onDoubleClick={(e) => selectAll(e.currentTarget)}
					>
						{event.responseName}
					</code>
					<span style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>
						Réponse attendue
					</span>
					{event.responseDescription && (
						<p style={{ margin: "0 0 0.5rem", color: "var(--color-text-muted)", fontSize: "0.82rem", lineHeight: 1.5 }}>
							{event.responseDescription}
						</p>
					)}
					{event.response && (
						<pre
							style={{
								margin: 0, padding: "0.85rem 1rem",
								background: "rgba(0,0,0,0.35)", border: "1px solid var(--color-border)",
								borderRadius: "12px", fontSize: "0.78rem", color: preColor,
								lineHeight: 1.65, overflowX: "auto", fontFamily: "monospace",
								userSelect: "text", WebkitUserSelect: "text", cursor: "text",
							}}
							onDoubleClick={(e) => selectAll(e.currentTarget)}
						>
							{formatJson(event.response)}
						</pre>
					)}
				</div>
			)}
		</div>
	);
}

function GroupedEvents({ events, onEdit, onDelete, onTest }: {
	events: WsEvent[];
	onEdit: (e: WsEvent) => void;
	onDelete: (id: string) => void;
	onTest: (e: WsEvent) => void;
}) {
	if (events.length === 0) {
		return <p style={{ color: "var(--color-text-muted)", fontSize: "0.88rem", fontStyle: "italic" }}>Aucun event documenté</p>;
	}
	return (
		<>
			{groupBy(events).map(([group, groupEvents]) => (
				<div key={group} style={{ marginBottom: "1.25rem" }}>
					<div style={{
						display: "flex", alignItems: "center", gap: "0.75rem",
						marginBottom: "0.75rem",
					}}>
						<span style={{
							fontSize: "0.7rem", fontWeight: 700,
							letterSpacing: "0.18em", textTransform: "uppercase",
							color: "var(--color-accent)",
							background: "var(--color-accent-soft)",
							padding: "0.2rem 0.6rem", borderRadius: "6px",
							border: "1px solid rgba(144,105,255,0.2)",
						}}>
							{group}
						</span>
						<div style={{ flex: 1, height: "1px", background: "var(--color-border)" }} />
					</div>
					{groupEvents.map((e) => (
						<EventCard key={e.id} event={e} onEdit={onEdit} onDelete={onDelete} onTest={onTest} />
					))}
				</div>
			))}
		</>
	);
}

const emptyForm = {
	name: "",
	direction: "front-to-back" as WsEvent["direction"],
	group: "",
	description: "",
	payload: "{\n  \n}",
	payloadDescription: "",
	response: "",
	responseName: "",
	responseDescription: "",
};

export default function DocsWsPage() {
	const { confirm } = useAlert();
	const [events, setEvents] = useState<WsEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [isOpen, setIsOpen] = useState(false);
	const [editing, setEditing] = useState<WsEvent | null>(null);
	const [testing, setTesting] = useState<WsEvent | null>(null);
	const [form, setForm] = useState(emptyForm);
	const [error, setError] = useState("");
	const [groupOpen, setGroupOpen] = useState(false);
	const [testPayload, setTestPayload] = useState("");
	const [testError, setTestError] = useState("");
	const textareaRefs = useRef<Partial<Record<TextareaField, HTMLTextAreaElement | null>>>({});
	const testPayloadRef = useRef<HTMLTextAreaElement | null>(null);
	const [testStatus, setTestStatus] = useState<"idle" | "sent" | "waiting" | "received" | "timeout" | "error">("idle");
	const [testResponse, setTestResponse] = useState("");
	const [wsLogs, setWsLogs] = useState<WsLogEntry[]>([]);
	const testListenerRef = useRef<{ eventName: string; handler: (data: unknown) => void } | null>(null);
	const testTimeoutRef = useRef<number | null>(null);
	const logsContainerRef = useRef<HTMLDivElement | null>(null);

	const allGroups = [...new Set(events.map((e) => e.group).filter(Boolean))];
	const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

	useEffect(() => {
		fetch(`${BACKEND_URL}/ws-docs`)
			.then((r) => r.json())
			.then((data) => { setEvents(data); setLoading(false); })
			.catch(() => setLoading(false));
	}, []);

	function appendWsLog(direction: WsLogEntry["direction"], event: string, args: unknown[] = []) {
		const payload = formatLogPayload(args);
		if (!payload) return;
		const entry: WsLogEntry = {
			id: crypto.randomUUID(),
			direction,
			event,
			payload,
			time: new Date().toLocaleTimeString("fr-FR", { hour12: false }),
		};
		setWsLogs((logs) => [...logs.slice(-199), entry]);
	}

	async function save(updated: WsEvent[]) {
		await fetch(`${BACKEND_URL}/ws-docs`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(updated),
		});
		setEvents(updated);
	}

	function openAdd() {
		setEditing(null);
		setForm(emptyForm);
		setError("");
		setIsOpen(true);
	}

	function openEdit(event: WsEvent) {
		setEditing(event);
		setForm({
			name: event.name,
			direction: event.direction,
			group: event.group ?? "",
			description: event.description,
			payload: formatJson(event.payload),
			payloadDescription: event.payloadDescription ?? "",
			response: event.response ? formatJson(event.response) : "",
			responseName: event.responseName ?? "",
			responseDescription: event.responseDescription ?? "",
		});
		setError("");
		setIsOpen(true);
	}

	function clearTestListener() {
		if (testListenerRef.current) {
			socket.off(testListenerRef.current.eventName, testListenerRef.current.handler);
			testListenerRef.current = null;
		}
		if (testTimeoutRef.current !== null) {
			window.clearTimeout(testTimeoutRef.current);
			testTimeoutRef.current = null;
		}
	}

	function closeTestModal() {
		clearTestListener();
		setTesting(null);
		setTestPayload("");
		setTestError("");
		setTestResponse("");
		setTestStatus("idle");
	}

	function openTest(event: WsEvent) {
		clearTestListener();
		setTesting(event);
		setTestPayload(getTestPayloadSeed(event.payload));
		setTestError("");
		setTestResponse("");
		setTestStatus("idle");
	}

	async function handleDelete(id: string) {
		const ok = await confirm({
			title: "Supprimer cet event ?",
			message: "Cette action est irréversible.",
			confirmLabel: "Supprimer",
		});
		if (!ok) return;
		await save(events.filter((e) => e.id !== id));
	}

	function handleTabNewline(e: React.KeyboardEvent<HTMLTextAreaElement>, field: "description" | "payloadDescription" | "responseDescription") {
		if (e.key !== "Tab") return;
		e.preventDefault();
		const el = e.currentTarget;
		const start = el.selectionStart;
		const end = el.selectionEnd;
		const newValue = form[field].substring(0, start) + "\n" + form[field].substring(end);
		setForm((f) => ({ ...f, [field]: newValue }));
		requestAnimationFrame(() => {
			el.selectionStart = start + 1;
			el.selectionEnd = start + 1;
			resizeTextarea(el, 6);
		});
	}

	function handleTabKey(e: React.KeyboardEvent<HTMLTextAreaElement>, field: "payload" | "response") {
		if (e.key !== "Tab") return;
		e.preventDefault();
		const el = e.currentTarget;
		const start = el.selectionStart;
		const end = el.selectionEnd;
		const indent = "  ";
		const newValue = form[field].substring(0, start) + indent + form[field].substring(end);
		setForm((f) => ({ ...f, [field]: newValue }));
		requestAnimationFrame(() => {
			el.selectionStart = start + indent.length;
			el.selectionEnd = start + indent.length;
			resizeTextarea(el, 8);
		});
	}

	useEffect(() => {
		for (const [field, el] of Object.entries(textareaRefs.current) as [TextareaField, HTMLTextAreaElement | null][]) {
			if (!el) continue;
			resizeTextarea(el, field === "payload" || field === "response" ? 8 : 6);
		}
	}, [form, isOpen]);

	useEffect(() => {
		if (testing && testPayloadRef.current) {
			resizeTextarea(testPayloadRef.current, 8);
		}
	}, [testing, testPayload]);

	useEffect(() => closeTestModal, []);

	useEffect(() => {
		const incomingListener = (event: string, ...args: unknown[]) => appendWsLog("incoming", event, args);
		const outgoingListener = (event: string, ...args: unknown[]) => appendWsLog("outgoing", event, args);
		const disconnectListener = (reason: string) => appendWsLog("status", "disconnect", [{ reason }]);
		const connectErrorListener = (err: Error) => appendWsLog("status", "connect_error", [{ message: err.message }]);

		socket.onAny(incomingListener);
		socket.onAnyOutgoing(outgoingListener);
		socket.on("disconnect", disconnectListener);
		socket.on("connect_error", connectErrorListener);

		return () => {
			socket.offAny(incomingListener);
			socket.offAnyOutgoing(outgoingListener);
			socket.off("disconnect", disconnectListener);
			socket.off("connect_error", connectErrorListener);
		};
	}, []);

	useEffect(() => {
		if (logsContainerRef.current) {
			logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
		}
	}, [wsLogs]);

	async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
		e.preventDefault();
		const event: WsEvent = {
			id: editing?.id ?? crypto.randomUUID(),
			name: form.name,
			direction: form.direction,
			group: form.group,
			description: form.description,
			payload: form.payload,
			payloadDescription: form.payloadDescription,
			response: form.response,
			responseName: form.responseName,
			responseDescription: form.responseDescription,
		};
		const updated = editing
			? events.map((e) => (e.id === editing.id ? event : e))
			: [...events, event];
		await save(updated);
		setIsOpen(false);
	}

	function handleTestSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!testing) return;

		clearTestListener();
		setTestError("");
		setTestResponse("");

		if (!socket.connected) {
			setTestStatus("error");
			setTestError("Socket non connecté au backend.");
			return;
		}

		let parsedPayload: unknown;
		try {
			parsedPayload = testPayload.trim() ? JSON.parse(testPayload) : undefined;
		} catch {
			setTestStatus("error");
			setTestError("Le payload de test doit être un JSON valide.");
			return;
		}

		if (testing.responseName) {
			const handler = (data: unknown) => {
				setTestResponse(JSON.stringify(data, null, 2));
				setTestStatus("received");
				if (testTimeoutRef.current !== null) {
					window.clearTimeout(testTimeoutRef.current);
					testTimeoutRef.current = null;
				}
				socket.off(testing.responseName, handler);
				testListenerRef.current = null;
			};

			testListenerRef.current = { eventName: testing.responseName, handler };
			socket.on(testing.responseName, handler);
			setTestStatus("waiting");
			testTimeoutRef.current = window.setTimeout(() => {
				socket.off(testing.responseName, handler);
				testListenerRef.current = null;
				testTimeoutRef.current = null;
				setTestStatus("timeout");
			}, 10000);
		} else {
			setTestStatus("sent");
		}

		if (typeof parsedPayload === "undefined") {
			socket.emit(testing.name);
		} else {
			socket.emit(testing.name, parsedPayload);
		}
	}

	const filtered = selectedGroup ? events.filter((e) => (e.group || "Général") === selectedGroup) : events;
	const frontToBack = filtered.filter((e) => e.direction === "front-to-back");
	const backToFront = filtered.filter((e) => e.direction === "back-to-front");

	return (
		<>
			{/* Header */}
			<section className="card" style={{
				padding: "1.5rem 2rem",
				display: "flex", justifyContent: "space-between", alignItems: "center",
				gap: "1.5rem",
				boxShadow: "var(--shadow-panel), var(--shadow-neon-cyan)",
			}}>
				<div>
					<p className="eyebrow">WebSocket API</p>
					<h2 style={{ marginTop: "0.4rem" }}>Documentation WS</h2>
					<div style={{ display: "flex", gap: "0.75rem", marginTop: "0.85rem" }}>
						<div className="badge">
							<span style={{ color: "var(--color-primary)", fontWeight: 700 }}>{frontToBack.length}</span>
							&nbsp;Front → Back
						</div>
						<div className="badge">
							<span style={{ color: "var(--color-secondary)", fontWeight: 700 }}>{backToFront.length}</span>
							&nbsp;Back → Front
						</div>
						{allGroups.length > 0 && (
							<div className="badge">
								<span style={{ color: "var(--color-accent)", fontWeight: 700 }}>{allGroups.length}</span>
								&nbsp;groupe{allGroups.length > 1 ? "s" : ""}
							</div>
						)}
					</div>
				</div>
				<button className="button button-primary" onClick={openAdd}>
					+ Ajouter un event
				</button>
			</section>

			{/* Filtres groupes */}
			{allGroups.length > 0 && (
				<div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
					<button
						className="button"
						onClick={() => setSelectedGroup(null)}
						style={{
							minHeight: "34px", padding: "0 1rem", fontSize: "0.78rem",
							border: `1px solid ${selectedGroup === null ? "var(--color-secondary)" : "var(--color-border)"}`,
							background: selectedGroup === null ? "var(--color-secondary-soft)" : "transparent",
							color: selectedGroup === null ? "var(--color-secondary)" : "var(--color-text-muted)",
							boxShadow: selectedGroup === null ? "var(--shadow-neon-cyan)" : "none",
						}}
					>
						Tous <span style={{ opacity: 0.6 }}>({events.length})</span>
					</button>
					{allGroups.map((g) => {
						const count = events.filter((e) => (e.group || "Général") === g).length;
						const active = selectedGroup === g;
						return (
							<button
								key={g}
								className="button"
								onClick={() => setSelectedGroup(active ? null : g)}
								style={{
									minHeight: "34px", padding: "0 1rem", fontSize: "0.78rem",
									border: `1px solid ${active ? "rgba(144,105,255,0.5)" : "var(--color-border)"}`,
									background: active ? "var(--color-accent-soft)" : "transparent",
									color: active ? "var(--color-accent)" : "var(--color-text-muted)",
									boxShadow: active ? "0 0 0 1px rgba(144,105,255,0.14), 0 0 20px rgba(144,105,255,0.18)" : "none",
									textTransform: "uppercase",
									letterSpacing: "0.1em",
								}}
							>
								{g} <span style={{ opacity: 0.6 }}>({count})</span>
							</button>
						);
					})}
				</div>
			)}

			<div className="docs-ws-grid">
				<div>
					{/* Events */}
					{loading ? (
						<p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "2rem" }}>
							Chargement...
						</p>
					) : (
						<div className="split-grid">
							<div>
								<p className="section-kicker" style={{ color: "var(--color-primary)", marginBottom: "1rem" }}>
									↑ Front → Back
								</p>
								<GroupedEvents events={frontToBack} onEdit={openEdit} onDelete={handleDelete} onTest={openTest} />
							</div>
							<div>
								<p className="section-kicker" style={{ marginBottom: "1rem" }}>
									↓ Back → Front
								</p>
								<GroupedEvents events={backToFront} onEdit={openEdit} onDelete={handleDelete} onTest={openTest} />
							</div>
						</div>
					)}
				</div>

				<section className="card" style={{
					padding: "1.5rem 2rem",
					boxShadow: "var(--shadow-panel), var(--shadow-neon-cyan)",
					alignSelf: "start",
					position: "sticky",
					top: "1rem",
					height: "calc(100vh - 21rem)",
					overflow: "hidden",
					display: "flex",
					flexDirection: "column",
					gap: "1rem",
				}}>
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
						<div>
							<p className="section-kicker" style={{ marginBottom: "0.45rem" }}>Logs WS</p>
							<p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
								{socket.connected ? "Socket connecté" : "Socket non connecté"}
							</p>
						</div>
						<button
							type="button"
							className="button button-outline"
							onClick={() => setWsLogs([])}
						>
							Vider
						</button>
					</div>

					<div
						ref={logsContainerRef}
						style={{
							display: "grid",
							gap: "0.75rem",
							flex: 1,
							minHeight: 0,
							overflowY: "auto",
							paddingRight: "0.25rem",
						}}
					>
						{wsLogs.length === 0 ? (
							<p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "0.88rem", fontStyle: "italic" }}>
								Aucun log WebSocket pour le moment.
							</p>
						) : (
							wsLogs.map((log) => {
								const color = log.direction === "incoming"
									? "var(--color-accent)"
									: log.direction === "outgoing"
										? "var(--color-secondary)"
										: "var(--color-primary)";

								return (
									<div
										key={log.id}
										style={{
											border: "1px solid var(--color-border)",
											borderRadius: "12px",
											background: "rgba(0,0,0,0.28)",
											padding: "0.9rem 1rem",
										}}
									>
										<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: log.payload ? "0.6rem" : 0 }}>
											<div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0 }}>
												<span style={{
													display: "inline-block",
													padding: "0.22rem 0.5rem",
													borderRadius: "999px",
													border: `1px solid ${color}33`,
													background: `${color}18`,
													color,
													fontSize: "0.68rem",
													fontWeight: 700,
													letterSpacing: "0.12em",
													textTransform: "uppercase",
													flexShrink: 0,
												}}>
													{log.direction === "incoming" ? "in" : log.direction === "outgoing" ? "out" : "status"}
												</span>
												<code style={{ color, fontSize: "0.8rem", overflowWrap: "anywhere" }}>{log.event}</code>
											</div>
											<span style={{ color: "var(--color-text-muted)", fontSize: "0.76rem", flexShrink: 0 }}>{log.time}</span>
										</div>

										{log.payload && (
											<pre
												style={{
													margin: 0,
													padding: "0.8rem 0.9rem",
													background: "rgba(0,0,0,0.35)",
													border: "1px solid var(--color-border)",
													borderRadius: "10px",
													fontSize: "0.77rem",
													lineHeight: 1.6,
													overflowX: "auto",
													fontFamily: "monospace",
													color: "var(--color-text-muted)",
													userSelect: "text",
													WebkitUserSelect: "text",
												}}
											>
												{log.payload}
											</pre>
										)}
									</div>
								);
							})
						)}
					</div>
				</section>
			</div>

			{/* Modal */}
			{isOpen && (
				<div style={{
					position: "fixed", inset: 0,
					background: "rgba(0,0,0,0.72)",
					display: "flex", alignItems: "center", justifyContent: "center",
					zIndex: 50, padding: "1rem",
					backdropFilter: "blur(6px)",
				}}>
					<div className="card" style={{
						width: "100%", maxWidth: "860px",
						maxHeight: "90vh", overflowY: "auto",
						boxShadow: "var(--shadow-panel), var(--shadow-neon-cyan)",
						padding: 0,
					}}>
						<div style={{
							display: "flex", justifyContent: "space-between", alignItems: "center",
							padding: "1.25rem 1.5rem",
							borderBottom: "1px solid var(--color-border)",
						}}>
							<p className="eyebrow" style={{ margin: 0 }}>
								{editing ? "Modifier l'event" : "Nouvel event"}
							</p>
							<button
								onClick={() => setIsOpen(false)}
								style={{ color: "var(--color-text-muted)", fontSize: "1.4rem", lineHeight: 1, cursor: "pointer" }}
							>
								×
							</button>
						</div>

						<form onSubmit={handleSubmit} autoComplete="off" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
							<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
								<div>
									<span style={labelStyle}>Direction</span>
									<select
										value={form.direction}
										onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value as WsEvent["direction"] }))}
										style={inputStyle}
									>
										<option value="front-to-back">↑ Front → Back</option>
										<option value="back-to-front">↓ Back → Front</option>
									</select>
								</div>
								<div style={{ position: "relative" }}>
									<span style={labelStyle}>
										Groupe <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optionnel)</span>
									</span>
									<input
										type="text"
										value={form.group}
										onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
										onFocus={() => setGroupOpen(true)}
										onBlur={() => setTimeout(() => setGroupOpen(false), 150)}
										placeholder="user, game…"
										{...passwordManagerIgnoreProps}
										style={{ ...inputStyle, color: "var(--color-accent)" }}
									/>
									{groupOpen && allGroups.length > 0 && (
										<div style={{
											position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
											background: "var(--color-bg-1)",
											border: "1px solid var(--color-border)",
											borderRadius: "10px",
											overflow: "hidden",
											zIndex: 10,
											boxShadow: "var(--shadow-panel)",
										}}>
											{allGroups.filter((g) => g.toLowerCase().includes(form.group.toLowerCase())).map((g) => (
												<button
													key={g}
													type="button"
													onMouseDown={() => setForm((f) => ({ ...f, group: g }))}
													style={{
														display: "block", width: "100%", textAlign: "left",
														padding: "0.55rem 0.9rem",
														background: "transparent",
														color: form.group === g ? "var(--color-accent)" : "var(--color-text-muted)",
														fontSize: "0.85rem",
														letterSpacing: "0.06em",
														borderBottom: "1px solid var(--color-border)",
														cursor: "pointer",
													}}
													onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-accent-soft)")}
													onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
												>
													{g}
												</button>
											))}
										</div>
									)}
								</div>
							</div>

							<div>
								<span style={labelStyle}>
									Description <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optionnel)</span>
								</span>
								<textarea
									value={form.description}
									onChange={(e) => {
										setForm((f) => ({ ...f, description: e.target.value }));
										resizeTextarea(e.currentTarget, 6);
									}}
									onKeyDown={(e) => handleTabNewline(e, "description")}
									ref={(el) => {
										textareaRefs.current.description = el;
										if (el) resizeTextarea(el, 6);
									}}
									rows={1} spellCheck={false}
									placeholder="Vérifie si un nom d'utilisateur est disponible"
									{...passwordManagerIgnoreProps}
									style={{ ...inputStyle, resize: "none", overflow: "hidden" }}
								/>
							</div>

							<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", alignItems: "start" }}>
								<div>
									<span style={labelStyle}>Nom de l'event</span>
									<input
										type="text"
										value={form.name}
										onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
										placeholder="user:check-username"
										required
										{...passwordManagerIgnoreProps}
										style={{ ...inputStyle, fontFamily: "var(--font-display)", fontSize: "0.82rem", letterSpacing: "0.04em", marginBottom: "1rem" }}
									/>

									<span style={labelStyle}>
										Payload <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--color-secondary)" }}>(JSON / schema)</span>
									</span>
									<textarea
										value={form.payloadDescription}
										onChange={(e) => {
											setForm((f) => ({ ...f, payloadDescription: e.target.value }));
											resizeTextarea(e.currentTarget, 6);
										}}
										onKeyDown={(e) => handleTabNewline(e, "payloadDescription")}
										ref={(el) => {
											textareaRefs.current.payloadDescription = el;
											if (el) resizeTextarea(el, 6);
										}}
										rows={1} spellCheck={false}
										placeholder="Description du payload (optionnel)"
										{...passwordManagerIgnoreProps}
										style={{ ...inputStyle, resize: "none", overflow: "hidden", marginBottom: "0.5rem" }}
									/>
									<textarea
										value={form.payload}
										onChange={(e) => {
											setForm((f) => ({ ...f, payload: e.target.value }));
											resizeTextarea(e.currentTarget, 8);
										}}
										onKeyDown={(e) => handleTabKey(e, "payload")}
										ref={(el) => {
											textareaRefs.current.payload = el;
											if (el) resizeTextarea(el, 8);
										}}
										rows={1} required spellCheck={false}
										{...passwordManagerIgnoreProps}
										style={{ ...inputStyle, fontFamily: "monospace", resize: "none", color: "var(--color-secondary)", overflowY: "hidden" }}
									/>
								</div>

								<div>
									<span style={labelStyle}>Nom de l'event de réponse <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optionnel)</span></span>
									<input
										type="text"
										value={form.responseName}
										onChange={(e) => setForm((f) => ({ ...f, responseName: e.target.value }))}
										placeholder="user:check-username:result"
										{...passwordManagerIgnoreProps}
										style={{ ...inputStyle, fontFamily: "var(--font-display)", fontSize: "0.82rem", letterSpacing: "0.04em", marginBottom: "1rem" }}
									/>

									<div>
										<span style={labelStyle}>
											Réponse attendue <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(JSON / schema)</span>
										</span>
										<textarea
											value={form.responseDescription}
											onChange={(e) => {
												setForm((f) => ({ ...f, responseDescription: e.target.value }));
												resizeTextarea(e.currentTarget, 6);
											}}
											onKeyDown={(e) => handleTabNewline(e, "responseDescription")}
											ref={(el) => {
												textareaRefs.current.responseDescription = el;
												if (el) resizeTextarea(el, 6);
											}}
											rows={1} spellCheck={false}
											placeholder="Description de la réponse (optionnel)"
											{...passwordManagerIgnoreProps}
											style={{ ...inputStyle, resize: "none", overflow: "hidden", marginBottom: "0.5rem" }}
										/>
										<textarea
											value={form.response}
											onChange={(e) => {
												setForm((f) => ({ ...f, response: e.target.value }));
												resizeTextarea(e.currentTarget, 8);
											}}
											onKeyDown={(e) => handleTabKey(e, "response")}
											ref={(el) => {
												textareaRefs.current.response = el;
												if (el) resizeTextarea(el, 8);
											}}
											rows={1} spellCheck={false}
											placeholder="Laisser vide si pas de réponse"
											{...passwordManagerIgnoreProps}
											style={{ ...inputStyle, fontFamily: "monospace", resize: "none", color: "var(--color-accent)", overflowY: "hidden" }}
										/>
									</div>
								</div>
							</div>

							{error && <p style={{ color: "var(--color-primary)", fontSize: "0.85rem", margin: 0 }}>{error}</p>}

							<div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.5rem" }}>
								<button type="button" className="button button-outline" onClick={() => setIsOpen(false)}>
									Annuler
								</button>
								<button type="submit" className="button button-primary">
									{editing ? "Sauvegarder" : "Ajouter"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{testing && (
				<div style={{
					position: "fixed", inset: 0,
					background: "rgba(0,0,0,0.72)",
					display: "flex", alignItems: "center", justifyContent: "center",
					zIndex: 60, padding: "1rem",
					backdropFilter: "blur(6px)",
				}}>
					<div className="card" style={{
						width: "100%", maxWidth: "720px",
						boxShadow: "var(--shadow-panel), var(--shadow-neon-cyan)",
						padding: 0,
					}}>
						<div style={{
							display: "flex", justifyContent: "space-between", alignItems: "center",
							padding: "1.25rem 1.5rem",
							borderBottom: "1px solid var(--color-border)",
						}}>
							<div>
								<p className="eyebrow" style={{ margin: 0 }}>Tester l'event</p>
								<code style={{ color: "var(--color-secondary)", fontSize: "0.82rem" }}>{testing.name}</code>
							</div>
							<button
								onClick={closeTestModal}
								style={{ color: "var(--color-text-muted)", fontSize: "1.4rem", lineHeight: 1, cursor: "pointer" }}
							>
								×
							</button>
						</div>

						<form onSubmit={handleTestSubmit} autoComplete="off" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
							<div>
								<span style={labelStyle}>Statut</span>
								<p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
									{testStatus === "idle" ? "Prêt à envoyer le test." : null}
									{testStatus === "waiting" && testing.responseName ? `Event envoyé. En attente de ${testing.responseName}...` : null}
									{testStatus === "received" && testing.responseName ? `Réponse ${testing.responseName} reçue.` : null}
									{testStatus === "sent" ? "Event envoyé. Aucune réponse attendue." : null}
									{testStatus === "timeout" && testing.responseName ? `Aucune réponse ${testing.responseName} reçue après 10 secondes.` : null}
									{testStatus === "error" ? "L'envoi du test a échoué." : null}
								</p>
							</div>

							<div>
								<span style={labelStyle}>Payload à envoyer <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--color-secondary)" }}>(JSON)</span></span>
								<textarea
									value={testPayload}
									onChange={(e) => {
										setTestPayload(e.target.value);
										resizeTextarea(e.currentTarget, 8);
									}}
									onKeyDown={(e) => {
										if (e.key !== "Tab") return;
										e.preventDefault();
										const el = e.currentTarget;
										const start = el.selectionStart;
										const end = el.selectionEnd;
										const indent = "  ";
										const newValue = testPayload.substring(0, start) + indent + testPayload.substring(end);
										setTestPayload(newValue);
										requestAnimationFrame(() => {
											el.selectionStart = start + indent.length;
											el.selectionEnd = start + indent.length;
											resizeTextarea(el, 8);
										});
									}}
									ref={(el) => {
										testPayloadRef.current = el;
										if (el) resizeTextarea(el, 8);
									}}
									rows={1}
									spellCheck={false}
									placeholder='{"key": "value"}'
									{...passwordManagerIgnoreProps}
									style={{ ...inputStyle, fontFamily: "monospace", resize: "none", color: "var(--color-secondary)", overflowY: "hidden" }}
								/>
							</div>

							{testing.responseName && (
								<div>
									<code style={{
										display: "inline-block", marginBottom: "0.5rem",
										color: "var(--color-accent)", fontSize: "0.82rem", letterSpacing: "0.04em",
										background: "var(--color-accent-soft)",
										padding: "0.3rem 0.65rem", borderRadius: "8px",
										border: "1px solid rgba(144,105,255,0.2)",
										userSelect: "text", WebkitUserSelect: "text", cursor: "text",
									}}
									onDoubleClick={(e) => selectAll(e.currentTarget)}
									>
										{testing.responseName}
									</code>
									<span style={labelStyle}>Réponse attendue</span>
									{testing.responseDescription && (
										<p style={{ margin: "0 0 0.5rem", color: "var(--color-text-muted)", fontSize: "0.82rem", lineHeight: 1.5 }}>
											{testing.responseDescription}
										</p>
									)}
									{testing.response && (
										<pre
											style={{
												margin: 0, padding: "0.85rem 1rem",
												background: "rgba(0,0,0,0.35)", border: "1px solid var(--color-border)",
												borderRadius: "12px", fontSize: "0.78rem", color: "var(--color-accent)",
												lineHeight: 1.65, overflowX: "auto", fontFamily: "monospace",
												userSelect: "text", WebkitUserSelect: "text", cursor: "text",
											}}
											onDoubleClick={(e) => selectAll(e.currentTarget)}
										>
											{formatJson(testing.response)}
										</pre>
									)}
								</div>
							)}

							{testResponse && (
								<div>
									<span style={labelStyle}>Réponse reçue <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--color-accent)" }}>(runtime)</span></span>
									<pre
										style={{
											margin: 0, padding: "0.85rem 1rem",
											background: "rgba(0,0,0,0.35)", border: "1px solid var(--color-border)",
											borderRadius: "12px", fontSize: "0.78rem", color: "var(--color-accent)",
											lineHeight: 1.65, overflowX: "auto", fontFamily: "monospace",
											userSelect: "text", WebkitUserSelect: "text", cursor: "text",
										}}
										onDoubleClick={(e) => selectAll(e.currentTarget)}
									>
										{testResponse}
									</pre>
								</div>
							)}

							{testError && <p style={{ color: "var(--color-primary)", fontSize: "0.85rem", margin: 0 }}>{testError}</p>}

							<div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
								<button type="submit" className="button button-primary">
									Envoyer
								</button>
								<button type="button" className="button button-outline" onClick={closeTestModal}>
									Fermer
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</>
	);
}
