document.addEventListener('DOMContentLoaded', function () {
  // 1) Display blocks exported by the WordPress KaTeX plugin:
  //    <div class="katex-eq" data-katex-display="true"><pre>TeX</pre></div>
  document.querySelectorAll('.katex-eq').forEach(function (el) {
    if (el.querySelector('.katex')) return; // already rendered
    var pre = el.querySelector('pre');
    var tex = (pre ? pre.textContent : el.textContent).trim();
    katex.render(tex, el, {
      displayMode: el.getAttribute('data-katex-display') === 'true',
      throwOnError: false
    });
  });

  // 2) Inline formulas [katex]...[/katex], plus the standard LaTeX delimiters
  renderMathInElement(document.getElementById('main-content') || document.body, {
    delimiters: [
      { left: '[katex]', right: '[/katex]', display: false },
      { left: '$$', right: '$$', display: true },
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false }
    ],
    ignoredClasses: ['katex', 'katex-display'],
    throwOnError: false
  });
});
