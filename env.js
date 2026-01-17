<script>
  // Vercel n’injecte pas directement les variables dans un site statique.
  // On utilise la réécriture côté build via "Build Command" ou on colle les valeurs au moment du déploiement.
  // Méthode simple sous Vercel : on crée env.js au déploiement avec les valeurs.
  window.__ENV__ = {
    SUPABASE_URL: "%%SUPABASE_URL%%",
    SUPABASE_ANON_KEY: "%%SUPABASE_ANON_KEY%%"
  };
</script>
