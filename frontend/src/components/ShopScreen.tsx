import { useShop } from "../contexts/ShopContext";
import { useAlert } from "./Alert";
import { PIECE_THEMES, type PieceTheme } from "../config/pieceThemes";
import PiecePreview from "./PiecePreview";

// Écran boutique rendu À L'INTÉRIEUR du dashboard (même fond parallax, pas de
// navigation). Le solde est affiché en haut à droite par le dashboard.
export default function ShopScreen() {
	const { berrys, owned, equipped, catalog, lastError, buy, equip, clearError } = useShop();
	const { confirm } = useAlert();

	const priceOf = (theme: PieceTheme): number =>
		catalog.find((c) => c.id === theme.id)?.price ?? theme.price;

	async function handleBuy(theme: PieceTheme, price: number) {
		const ok = await confirm({
			title: `Débloquer « ${theme.name} » ?`,
			message: `Coût : ${price.toLocaleString()} ฿\nIl te restera ${(berrys - price).toLocaleString()} ฿.`,
			confirmLabel: "Acheter",
			cancelLabel: "Annuler",
			danger: false,
		});
		if (ok) buy(theme.id);
	}

	return (
		<div className="shop-screen">
			<div className="shop-screen__head">
				<p className="eyebrow">Boutique</p>
				<h2 className="shop-screen__title">Thèmes de pièces</h2>
				<p className="shop-screen__hint">
					Débloque un thème, puis équipe-le pour changer le look de tes pièces en jeu.
				</p>
			</div>

			{lastError && (
				<div className="shop__error" role="alert">
					<span>{lastError}</span>
					<button className="shop__error-close" onClick={clearError} aria-label="Fermer">
						✕
					</button>
				</div>
			)}

			<div className="shop__grid">
				{PIECE_THEMES.map((theme) => {
					const price = priceOf(theme);
					const isOwned = owned.includes(theme.id);
					const isEquipped = equipped === theme.id;
					const canAfford = berrys >= price;

					return (
						<article
							key={theme.id}
							className={`shop-card${isEquipped ? " shop-card--equipped" : ""}`}
						>
							<div className="shop-card__preview">
								<PiecePreview themeId={theme.id} cellSize={16} />
							</div>

							<div className="shop-card__body">
								<div className="shop-card__head">
									<h3 className="shop-card__name">{theme.name}</h3>
									{isOwned ? (
										<span className="shop-card__tag shop-card__tag--owned">Possédé</span>
									) : (
										<span className="shop-card__tag shop-card__tag--price">{price.toLocaleString()} ฿</span>
									)}
								</div>
								<p className="shop-card__desc">{theme.description}</p>

								<div className="shop-card__actions">
									{isEquipped ? (
										<button className="button shop-card__btn shop-card__btn--equipped" disabled>
											✓ Équipé
										</button>
									) : isOwned ? (
										<button
											className="button button-primary shop-card__btn"
											onClick={() => equip(theme.id)}
										>
											Équiper
										</button>
									) : (
										<button
											className="button button-outline shop-card__btn"
											onClick={() => handleBuy(theme, price)}
											disabled={!canAfford}
											title={canAfford ? undefined : "Butin insuffisant"}
										>
											{canAfford ? `Acheter · ${price.toLocaleString()} ฿` : "Butin insuffisant"}
										</button>
									)}
								</div>
							</div>
						</article>
					);
				})}
			</div>
		</div>
	);
}
