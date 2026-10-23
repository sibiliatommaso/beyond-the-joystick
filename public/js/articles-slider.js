(() => {
    "use strict";

    document.querySelectorAll("[data-articles-slider]").forEach((slider) => {
        const viewport = slider.querySelector(".articles-slider__viewport");
        const track = slider.querySelector(".articles-slider__track");
        const slides = Array.from(
            slider.querySelectorAll(".articles-slider__slide")
        );

        const prevButton = slider.querySelector("[data-slider-prev]");
        const nextButton = slider.querySelector("[data-slider-next]");
        const pauseButton = slider.querySelector("[data-slider-pause]");
        const dotsContainer = slider.querySelector("[data-slider-dots]");

        if (!viewport || !track || slides.length < 2) {
            return;
        }

        const reducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        );

        const dots = [];
        let currentIndex = 0;
        let visibleCount = getVisibleCount();
        let timer = null;
        let paused = reducedMotion.matches;
        let pointerInside = false;
        let focusedInside = false;

        function getVisibleCount() {
            if (window.matchMedia("(min-width: 900px)").matches) {
                return 3;
            }

            if (window.matchMedia("(min-width: 720px)").matches) {
                return 2;
            }

            return 1;
        }

        function getMaxIndex() {
            return Math.max(0, slides.length - visibleCount);
        }

        function buildDots() {
            dotsContainer.replaceChildren();
            dots.length = 0;

            for (let i = 0; i <= getMaxIndex(); i += 1) {
                const dot = document.createElement("button");

                dot.type = "button";
                dot.className = "articles-slider__dot";
                dot.setAttribute("aria-label", `Show article position ${i + 1}`);

                dot.addEventListener("click", () => {
                    goTo(i);
                    restartTimer();
                });

                dotsContainer.appendChild(dot);
                dots.push(dot);
            }
        }

        function updateControls() {
            dots.forEach((dot, index) => {
                if (index === currentIndex) {
                    dot.setAttribute("aria-current", "true");
                } else {
                    dot.removeAttribute("aria-current");
                }
            });

            if (prevButton) {
                prevButton.disabled = currentIndex === 0;
            }

            if (nextButton) {
                nextButton.disabled = currentIndex === getMaxIndex();
            }

            if (pauseButton) {
                pauseButton.textContent = paused ? "Play" : "Pause";
                pauseButton.setAttribute("aria-pressed", String(paused));
                pauseButton.setAttribute(
                    "aria-label",
                    paused ? "Resume automatic scrolling" : "Pause automatic scrolling"
                );
            }
        }

        function goTo(index) {
            currentIndex = Math.max(0, Math.min(index, getMaxIndex()));

            const firstSlideOffset = slides[0].offsetLeft;
            const targetOffset = slides[currentIndex].offsetLeft - firstSlideOffset;

            track.style.transform = `translateX(-${targetOffset}px)`;

            updateControls();
        }

        function stopTimer() {
            if (timer !== null) {
                window.clearInterval(timer);
                timer = null;
            }
        }

        function startTimer() {
            stopTimer();

            if (
                paused ||
                pointerInside ||
                focusedInside ||
                document.hidden ||
                slides.length <= visibleCount
            ) {
                return;
            }

            timer = window.setInterval(() => {
                if (currentIndex >= getMaxIndex()) {
                    goTo(0);
                } else {
                    goTo(currentIndex + 1);
                }
            }, 5000);
        }

        function restartTimer() {
            startTimer();
        }

        prevButton?.addEventListener("click", () => {
            goTo(currentIndex - 1);
            restartTimer();
        });

        nextButton?.addEventListener("click", () => {
            goTo(currentIndex + 1);
            restartTimer();
        });

        pauseButton?.addEventListener("click", () => {
            paused = !paused;
            updateControls();
            restartTimer();
        });

        slider.addEventListener("mouseenter", () => {
            pointerInside = true;
            stopTimer();
        });

        slider.addEventListener("mouseleave", () => {
            pointerInside = false;
            startTimer();
        });

        slider.addEventListener("focusin", () => {
            focusedInside = true;
            stopTimer();
        });

        slider.addEventListener("focusout", (event) => {
            if (!slider.contains(event.relatedTarget)) {
                focusedInside = false;
                startTimer();
            }
        });

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                stopTimer();
            } else {
                startTimer();
            }
        });

        reducedMotion.addEventListener("change", (event) => {
            if (event.matches) {
                paused = true;
                updateControls();
                stopTimer();
            }
        });

        let resizeTimeout;

        window.addEventListener("resize", () => {
            window.clearTimeout(resizeTimeout);

            resizeTimeout = window.setTimeout(() => {
                const newVisibleCount = getVisibleCount();

                if (newVisibleCount !== visibleCount) {
                    visibleCount = newVisibleCount;
                    currentIndex = Math.min(currentIndex, getMaxIndex());
                    buildDots();
                }

                goTo(currentIndex);
                restartTimer();
            }, 120);
        });

        buildDots();
        goTo(0);
        startTimer();
    });
})();
