// Banque de questions — [question, camp A, camp B]
export const THEMES = ['Couple', 'Argent', 'Famille', 'Société'];

const RAW = {
  Couple: [
    ['Faut-il tout se dire dans un couple, même ce qui blesse ?', 'Oui', 'Non'],
    ['Pourquoi les hommes sont-ils infidèles… et les femmes alors ?', 'C’est la nature', 'C’est un choix'],
    ['Peut-on rester ami avec son ex ?', 'Oui', 'Jamais'],
    ['Fouiller le téléphone de son partenaire : trahison ou précaution ?', 'Trahison', 'Précaution'],
    ['L’amour suffit-il pour se marier ?', 'Oui', 'Non'],
    ['Une relation à distance peut-elle vraiment marcher ?', 'Oui', 'Non'],
    ['L’homme doit-il gagner plus que la femme dans le couple ?', 'Oui', 'Non'],
    ['Pardonner une infidélité, c’est de la force ou de la faiblesse ?', 'Force', 'Faiblesse'],
    ['Vivre ensemble avant le mariage : sage ou pas ?', 'Sage', 'Pas question'],
    ['Les réseaux sociaux détruisent-ils les couples ?', 'Oui', 'Non'],
  ],
  Argent: [
    ['Qui doit payer l’addition au premier rendez-vous ?', 'L’homme', 'On partage'],
    ['Aider sa famille financièrement : devoir ou piège ?', 'Devoir', 'Piège'],
    ['Faut-il dire son salaire à son partenaire ?', 'Oui', 'Non'],
    ['Compte commun ou comptes séparés dans le couple ?', 'Commun', 'Séparés'],
    ['Prêter de l’argent à un ami : bonne idée ou erreur ?', 'Bonne idée', 'Erreur'],
    ['Mieux vaut un salaire stable ou sa propre affaire ?', 'Salaire', 'Business'],
    ['Les tontines sont-elles plus sûres que la banque ?', 'Tontine', 'Banque'],
    ['L’argent fait-il le bonheur ?', 'Oui', 'Non'],
    ['Faut-il montrer sa réussite sur les réseaux ?', 'Oui', 'Non'],
    ['Une femme qui gagne plus que son mari, ça pose problème ?', 'Oui', 'Non'],
  ],
  Famille: [
    ['Le mariage précoce : protection ou prison ?', 'Protection', 'Prison'],
    ['La dot : tradition à garder ou commerce à abolir ?', 'À garder', 'À abolir'],
    ['Les parents doivent-ils choisir le conjoint de leurs enfants ?', 'Oui', 'Non'],
    ['Faut-il frapper un enfant pour l’éduquer ?', 'Oui', 'Non'],
    ['L’aîné doit-il prendre en charge ses frères et sœurs ?', 'Oui', 'Non'],
    ['Vivre chez ses parents après 30 ans : normal ou honte ?', 'Normal', 'Honte'],
    ['La belle-famille doit-elle avoir son mot à dire dans le couple ?', 'Oui', 'Non'],
    ['Faut-il apprendre la langue maternelle aux enfants avant le français ?', 'Oui', 'Non'],
    ['Avoir beaucoup d’enfants, est-ce encore une richesse ?', 'Oui', 'Non'],
    ['La polygamie a-t-elle encore sa place aujourd’hui ?', 'Oui', 'Non'],
  ],
  Société: [
    ['Partir à l’étranger, est-ce abandonner son pays ?', 'Oui', 'Non'],
    ['Les diplômes servent-ils encore à quelque chose ?', 'Oui', 'Non'],
    ['Le paraître est-il devenu plus important que l’être ?', 'Oui', 'Non'],
    ['Faut-il interdire les réseaux sociaux aux moins de 15 ans ?', 'Oui', 'Non'],
    ['La réussite, c’est le travail ou les relations ?', 'Le travail', 'Les relations'],
    ['Une femme peut-elle s’habiller comme elle veut sans être jugée ?', 'Oui', 'Non'],
    ['Faut-il rentrer au pays après ses études à l’étranger ?', 'Oui', 'Non'],
    ['Les influenceurs sont-ils de vrais modèles ?', 'Oui', 'Non'],
    ['Le respect des aînés doit-il être absolu ?', 'Oui', 'Non'],
    ['Le mariage est-il encore une obligation sociale ?', 'Oui', 'Non'],
  ],
};

export const QUESTIONS = THEMES.flatMap((theme) =>
  RAW[theme].map(([q, a, b]) => ({ q, a, b, theme }))
);
