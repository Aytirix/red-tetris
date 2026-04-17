Respecte strictement les contraintes de style et d’architecture du projet : frontend fonctionnel sans `this`, logique pure pour le board et les pièces, aucun Canvas, aucun SVG, aucune librairie de manipulation du DOM, aucune modification backend.

Interdiction stricte : toute modification backend est hors scope et interdite.

Tu as accès au projet dans VSCode. Implémente directement la détection des mains dans le Tetris existant.

Règles absolues :
- Tu ne dois en aucun cas modifier le backend.
- Tu ne dois toucher à aucun fichier backend.
- Tu ne dois lancer aucune refactorisation backend.
- Tu ne dois pas déplacer de logique vers le serveur.
- Toute l’implémentation doit rester strictement côté frontend.

Tous les nouveaux fichiers de cette fonctionnalité doivent être créés exclusivement dans `frontend/src/test/hands_detector/`. `TestPage.tsx` ne doit servir qu’au branchement de cette implémentation.

Organisation des fichiers obligatoire :
- Tu dois créer un dossier dédié dans `frontend/src/test/hands_detector/`
- Tous les fichiers que tu crées pour cette implémentation doivent être placés dans ce dossier
- Ne crée pas de fichiers de cette fonctionnalité ailleurs dans le frontend
- `TestPage.tsx` peut être modifié uniquement pour brancher l’implémentation existante depuis `frontend/src/test/hands_detector/`
- La logique ajoutée doit être proprement répartie dans ce dossier au lieu d’être entassée dans `TestPage.tsx`

Point d’entrée :
- le jeu est dans `frontend/src/test/TestPage.tsx`
- retrouve le bon fichier exact
- inspecte l’existant
- réutilise les fonctions déjà présentes pour :
  - déplacement gauche
  - déplacement droite
  - rotation
  - descente rapide
  - hard drop

Objectif :
Ajouter un contrôle du Tetris par webcam via détection des mains, uniquement dans le frontend existant.

Contraintes d’architecture obligatoires :
- Le code côté client (navigateur) doit être écrit sans utiliser le mot-clé `this`
- Le code frontend doit privilégier une approche fonctionnelle plutôt qu’orientée objet
- La logique du jeu liée au board et aux pièces doit être implémentée avec des fonctions pures
- Il ne faut pas introduire de manipulation directe du DOM
- Il ne faut utiliser aucune librairie de manipulation du DOM
- Il est interdit d’utiliser :
  - jQuery ou toute librairie similaire
  - Canvas
  - SVG
- Il n’y a pas besoin de manipuler directement le DOM pour cette implémentation
- Le code ajouté doit rester cohérent avec une architecture React fonctionnelle

À implémenter :
- intégrer `@mediapipe/tasks-vision`
- webcam avec `navigator.mediaDevices.getUserMedia`
- détection avec `detectForVideo`
- gestion jusqu’à 2 mains
- utilisation de la handedness pour distinguer main gauche et main droite
- boucle d’analyse avec `requestAnimationFrame`
- nettoyage propre à l’unmount

Gestes à implémenter :
- main droite + pouce/majeur => déplacement à droite
- main gauche + pouce/majeur => déplacement à gauche
- peu importe la main + pouce/index => rotation
- peu importe la main + pouce/auriculaire => descente rapide
- deux mains fermées en même temps => hard drop

Règles de comportement :
- priorité absolue au hard drop si les deux mains sont fermées
- sinon appliquer les autres gestes
- éviter les actions contradictoires sur une même frame
- ne pas casser les contrôles clavier existants
- garder le tout stable et jouable

Contraintes techniques :
- tout doit rester côté frontend
- aucun changement backend
- aucun changement API serveur
- aucun endpoint à créer ou modifier
- aucune dépendance backend à ajouter
- React + TypeScript uniquement pour cette tâche
- utiliser `@mediapipe/tasks-vision`
- utiliser `getUserMedia`
- utiliser `detectForVideo`
- utiliser `requestAnimationFrame`

Exigences d’implémentation :
- ajouter un `<video>` caché ou discret pour la webcam
- initialiser la caméra au montage du composant
- initialiser Hand Landmarker correctement
- analyser la vidéo en boucle
- récupérer les landmarks et la handedness
- détecter les contacts entre doigts avec une distance configurable
- détecter une main fermée de façon suffisamment fiable à partir des landmarks
- ajouter des cooldowns séparés pour :
  - move left/right
  - rotate
  - soft drop
  - hard drop

Structure attendue dans `frontend/src/test/hands_detector/` :
- mets dans ce dossier toute la logique liée à la webcam
- mets dans ce dossier toute la logique liée à MediaPipe
- mets dans ce dossier toute la logique de détection des gestes
- mets dans ce dossier toute la logique de mapping gestes -> actions
- mets dans ce dossier les constantes, seuils et cooldowns
- garde `TestPage.tsx` aussi léger que possible : import, initialisation, branchement, rendu éventuel du `video`

Contraintes de qualité de code :
- construire les fichiers proprement
- ne pas entasser toute la logique dans un seul bloc illisible
- factoriser proprement si nécessaire, uniquement côté frontend
- nommer clairement les fonctions et constantes
- séparer au minimum :
  - l’initialisation webcam
  - l’initialisation MediaPipe
  - l’analyse des landmarks
  - le mapping gestes -> actions
  - les cooldowns
- garder une logique lisible, maintenable et testable
- éviter toute logique dupliquée
- conserver les parties gameplay existantes et réutiliser leurs fonctions au lieu de les réécrire
- si une logique liée aux gestes est extraite, elle doit rester pure autant que possible
- toute logique de décision (ex: détection des doigts qui se touchent, main fermée, choix de l’action à déclencher) doit être écrite sous forme de fonctions simples et prédictibles

Contraintes d’édition :
- privilégier les modifications minimales dans `TestPage.tsx`
- toute nouvelle logique doit vivre dans `frontend/src/test/hands_detector/`
- ne modifie rien en dehors du frontend sauf nécessité absolue liée à une dépendance frontend
- ne touche jamais au backend

Méthode de travail :
- commence par inspecter les fichiers frontend concernés
- retrouve le bon `TestPage.tsx`
- crée le dossier `frontend/src/test/hands_detector/`
- implémente toute la fonctionnalité dans ce dossier
- branche ensuite cette implémentation dans `TestPage.tsx`
- prends des décisions techniques raisonnables sans demander validation à chaque étape
- applique les changements directement
- vérifie la cohérence TypeScript
- corrige les erreurs éventuelles
- termine avec une version prête à tester

À la fin, donne uniquement :
- les fichiers frontend modifiés
- les nouveaux fichiers créés dans `frontend/src/test/hands_detector/`
- les commandes frontend utilisées
- un résumé très court
- les points de test manuels

Important :
- n’analyse pas indéfiniment
- avance jusqu’à une version fonctionnelle
- n’effectue aucune modification backend, même mineure
- respecte strictement les contraintes fonctionnelles, d’architecture et d’organisation indiquées ci-dessus