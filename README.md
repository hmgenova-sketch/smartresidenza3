# Residenza Genova – PDF forms

index.html = one page with all four forms. Fill what you need (nothing is mandatory), duplicate pages with "Aggiungi pagina", then press Stampa (opens one combined PDF) or Scarica PDF.
The PDFs in templates/ are filled in the browser with pdf-lib. No server, nothing is uploaded.

Publish: public GitHub repo -> upload ALL files, keeping the folders templates/, lib/ and fonts/ -> Settings -> Pages -> Deploy from branch main / root.
Local test: `python -m http.server 8000`, then open http://localhost:8000

spec.json lists every field and its position on the PDF page (points, 595x842, origin top-left). Edit it to rename a field or nudge a box.
