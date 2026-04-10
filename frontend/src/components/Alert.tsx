import React, { createContext, useContext, useState, useCallback } from "react";

interface ConfirmOptions {
	title: string;
	message?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	danger?: boolean;
}

interface AlertOptions {
	title: string;
	message?: string;
	confirmLabel?: string;
	danger?: boolean;
}

interface AlertState {
	title: string;
	message?: string;
	confirmLabel: string;
	cancelLabel?: string;
	danger: boolean;
	showCancel: boolean;
	resolve: (value: boolean) => void;
}

interface AlertContextType {
	confirm: (options: ConfirmOptions) => Promise<boolean>;
	alert: (options: AlertOptions) => Promise<void>;
}

const AlertContext = createContext<AlertContextType | null>(null);

export function AlertProvider({ children }: { children: React.ReactNode }) {
	const [state, setState] = useState<AlertState | null>(null);

	const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
		return new Promise((resolve) => {
			setState({
				title: options.title,
				message: options.message,
				confirmLabel: options.confirmLabel ?? "Confirmer",
				cancelLabel: options.cancelLabel ?? "Annuler",
				danger: options.danger ?? true,
				showCancel: true,
				resolve,
			});
		});
	}, []);

	const alert = useCallback((options: AlertOptions): Promise<void> => {
		return new Promise((resolve) => {
			setState({
				title: options.title,
				message: options.message,
				confirmLabel: options.confirmLabel ?? "OK",
				danger: options.danger ?? false,
				showCancel: false,
				resolve: () => resolve(),
			});
		});
	}, []);

	function handleConfirm() {
		state?.resolve(true);
		setState(null);
	}

	function handleCancel() {
		state?.resolve(false);
		setState(null);
	}

	return (
		<AlertContext.Provider value={{ confirm, alert }}>
			{children}

			{state && (
				<div style={{
					position: "fixed", inset: 0,
					background: "rgba(0,0,0,0.72)",
					display: "flex", alignItems: "center", justifyContent: "center",
					zIndex: 100, padding: "1rem",
					backdropFilter: "blur(6px)",
				}}>
					<div
						className="card"
						style={{
							width: "100%", maxWidth: "400px", padding: 0,
							boxShadow: state.danger
								? "var(--shadow-panel), var(--shadow-neon-red)"
								: "var(--shadow-panel), var(--shadow-neon-cyan)",
						}}
					>
						<div style={{ padding: "1.5rem 1.5rem 0" }}>
							<p className="eyebrow" style={{
								color: state.danger ? "var(--color-primary)" : "var(--color-secondary)",
							}}>
								{state.danger ? "Attention" : "Info"}
							</p>
							<h3 style={{ marginTop: "0.5rem" }}>{state.title}</h3>
							{state.message && (
								<p style={{
									marginTop: "0.75rem",
									color: "var(--color-text-muted)",
									fontSize: "0.9rem",
									lineHeight: 1.6,
								}}>
									{state.message}
								</p>
							)}
						</div>

						<div style={{
							display: "flex", justifyContent: "flex-end", gap: "0.75rem",
							padding: "1.25rem 1.5rem",
							borderTop: "1px solid var(--color-border)",
							marginTop: "1.25rem",
						}}>
							{state.showCancel && (
								<button className="button button-outline" onClick={handleCancel}>
									{state.cancelLabel}
								</button>
							)}
							<button
								className="button"
								style={state.danger ? {
									background: "linear-gradient(135deg, var(--color-primary-strong), var(--color-primary))",
									boxShadow: "var(--shadow-neon-red)",
								} : {
									background: "rgba(61,231,255,0.12)",
									border: "1px solid rgba(61,231,255,0.22)",
									color: "var(--color-secondary)",
									boxShadow: "var(--shadow-neon-cyan)",
								}}
								onClick={handleConfirm}
							>
								{state.confirmLabel}
							</button>
						</div>
					</div>
				</div>
			)}
		</AlertContext.Provider>
	);
}

export function useAlert(): AlertContextType {
	const context = useContext(AlertContext);
	if (!context) throw new Error("useAlert must be used within AlertProvider");
	return context;
}
