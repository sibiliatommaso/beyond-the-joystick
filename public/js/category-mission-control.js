(() => {
  "use strict";

  const root = document.querySelector(".mc-category");
  if (!root) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /*
   * RADAR ARTICOLI
   *
   * Funziona con i punti generati da Hugo oppure,
   * come fallback, con il vecchio template che conteneva
   * soltanto tre punti statici.
   */

  const radar = root.querySelector(
    "[data-article-radar], .mc-radar"
  );

  if (radar) {
    let pointsContainer = radar.querySelector(
      "[data-radar-points], .mc-radar__points"
    );

    let current = radar.querySelector(
      "[data-radar-current], .mc-radar__current"
    );

    let points = Array.from(
      radar.querySelectorAll("[data-radar-point]")
    );

    /*
     * Crea il contenitore del titolo, se non esiste.
     */
    const makeCurrentSlot = () => {
      const slot = document.createElement("div");

      slot.className = "mc-radar__current";

      slot.setAttribute("data-radar-current", "");
      slot.setAttribute("aria-live", "polite");
      slot.setAttribute("aria-atomic", "true");

      radar.appendChild(slot);

      return slot;
    };

    if (!current) {
      current = makeCurrentSlot();
    }

    /*
     * COMPATIBILITÀ CON IL TEMPLATE ORIGINALE
     *
     * Se Hugo non ha generato punti con data-radar-point,
     * gli articoli vengono ricavati dalla griglia archivio.
     */

    if (points.length === 0) {
      let articleLinks = Array.from(
        root.querySelectorAll(
          ".mc-card__body h3 a[href]"
        )
      );

      /*
       * Se l'archivio non contiene link, prova con
       * l'articolo in evidenza.
       */
      if (articleLinks.length === 0) {
        articleLinks = Array.from(
          root.querySelectorAll(
            ".mc-featured__body h3 a[href]"
          )
        );
      }

      /*
       * Rimuove eventuali URL duplicati mantenendo
       * l'ordine originale degli articoli.
       */
      const uniqueArticles = [];
      const seenUrls = new Set();

      articleLinks.forEach((link) => {
        const url = link.href;

        if (!url || seenUrls.has(url)) {
          return;
        }

        seenUrls.add(url);

        uniqueArticles.push({
          title: link.textContent.trim(),
          url,
        });
      });

      /*
       * Elimina i vecchi pallini statici:
       * non devono comparire insieme a quelli dinamici.
       */
      radar
        .querySelectorAll(".mc-radar__point")
        .forEach((point) => point.remove());

      /*
       * Crea il contenitore per i punti, se necessario.
       */
      if (!pointsContainer) {
        pointsContainer = document.createElement("div");

        pointsContainer.className = "mc-radar__points";

        pointsContainer.setAttribute(
          "data-radar-points",
          ""
        );

        pointsContainer.setAttribute(
          "aria-hidden",
          "true"
        );

        radar.appendChild(pointsContainer);
      }

      /*
       * Un pallino per ogni articolo.
       */
      uniqueArticles.forEach(({ title, url }) => {
        const point = document.createElement("span");

        point.className = "mc-radar__point";

        point.setAttribute("data-radar-point", "");

        point.dataset.title = title;
        point.dataset.url = url;

        point.setAttribute("aria-hidden", "true");

        pointsContainer.appendChild(point);
      });

      points = Array.from(
        pointsContainer.querySelectorAll(
          "[data-radar-point]"
        )
      );
    }

    /*
     * Associa ogni pallino al titolo e all'URL.
     */
    const articles = points.map((point) => ({
      point,
      title: point.dataset.title || "",
      url: point.dataset.url || "#",
    }));

    const total = articles.length;
    const radius = 34;

    let activeIndex = 0;
    let timer = null;

    if (total > 0) {
      /*
       * Distribuisce i pallini lungo una circonferenza.
       */
      const coordinatesFor = (index) => {
        const angle =
          (2 * Math.PI * index) / total -
          Math.PI / 2;

        return {
          x: 50 + radius * Math.cos(angle),
          y: 50 + radius * Math.sin(angle),
        };
      };

      /*
       * Applica le coordinate a ogni pallino.
       */
      const positionPoints = () => {
        articles.forEach(({ point }, index) => {
          const { x, y } = coordinatesFor(index);

          point.style.left = `${x}%`;
          point.style.top = `${y}%`;
        });
      };

      /*
       * Illumina il pallino selezionato e mostra
       * il titolo cliccabile corrispondente.
       */
      const showArticle = (index) => {
        const article = articles[index];

        if (!article) return;

        activeIndex = index;

        /*
         * Aggiorna lo stato visivo dei pallini.
         */
        articles.forEach(({ point }, pointIndex) => {
          point.classList.toggle(
            "is-active",
            pointIndex === index
          );

          point.classList.toggle(
            "is-scanned",
            pointIndex < index
          );

          point.setAttribute(
            "aria-hidden",
            "true"
          );
        });

        /*
         * Crea il link del titolo.
         */
        const link = document.createElement("a");

        link.className = "mc-radar__article";

        link.href = article.url;

        link.textContent =
          article.title || "Open article";

        link.setAttribute(
          "aria-label",
          `Read article: ${
            article.title || "Open article"
          }`
        );

        /*
         * Colloca il titolo vicino al pallino attivo.
         */
        const { x, y } = coordinatesFor(index);

        link.style.left = `${x}%`;
        link.style.top = `${y}%`;

        /*
         * Gestisce la posizione per evitare che
         * il titolo si sovrapponga al pallino.
         */
        link.classList.toggle(
          "mc-radar__article--left",
          x >= 50
        );

        link.classList.toggle(
          "mc-radar__article--below",
          y < 25
        );

        link.classList.toggle(
          "mc-radar__article--above",
          y > 75
        );

        /*
         * Sostituisce il titolo precedente.
         */
        current.replaceChildren(link);
      };

      /*
       * Ferma il timer.
       */
      const stopRadar = () => {
        if (timer !== null) {
          window.clearInterval(timer);
          timer = null;
        }
      };

      /*
       * Cambia articolo ogni due secondi.
       */
      const startRadar = () => {
        if (
          total < 2 ||
          timer !== null ||
          document.hidden
        ) {
          return;
        }

        timer = window.setInterval(() => {
          const nextIndex =
            (activeIndex + 1) % total;

          showArticle(nextIndex);
        }, 2000);
      };

      /*
       * Avvio iniziale del radar.
       */
      positionPoints();
      showArticle(0);
      startRadar();

      /*
       * Aggiorna il radar al ridimensionamento.
       */
      window.addEventListener(
        "resize",
        () => {
          positionPoints();
          showArticle(activeIndex);
        },
        { passive: true }
      );

      /*
       * Sospende il timer quando la scheda è nascosta
       * e lo riavvia quando torna visibile.
       */
      document.addEventListener(
        "visibilitychange",
        () => {
          if (document.hidden) {
            stopRadar();
          } else {
            startRadar();
          }
        }
      );
    }
  }

  /*
   * ANIMAZIONI DI COMPARSA DELLE SEZIONI
   */

  const items = root.querySelectorAll(
    ".mc-briefing, .mc-last-article, .mc-card, .mc-divisions"
  );

  /*
   * Rispetta la preferenza di movimento ridotto
   * per le animazioni di comparsa delle sezioni.
   */
  if (
    prefersReducedMotion ||
    !("IntersectionObserver" in window)
  ) {
    items.forEach((item) => {
      item.classList.add("is-visible");
    });

    return;
  }

  /*
   * Imposta la classe iniziale delle animazioni.
   */
  items.forEach((item) => {
    item.classList.add("mc-reveal");
  });

  /*
   * Mostra le sezioni quando entrano nell'area visibile.
   */
  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");

          currentObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.12,
    }
  );

  items.forEach((item) => {
    observer.observe(item);
  });
})();
