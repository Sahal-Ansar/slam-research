import re,os
src='src'
css=open(f'{src}/style.css').read()
order=['core.js','mission.js','sims.js','v3d.js','lab.js','data_tables.js','data_vio.js','data_lio.js','data_rest.js','data_misc.js','app.js']
js='\n'.join(open(f'{src}/{f}').read() for f in order)
html=f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#ffffff" />
<meta name="description" content="SLAM for drones in GPS-denied environments: open-source methods, live simulations, embedded benchmarks, best-fit selector and research roadmap. A field guide prepared for Sirisha." />
<title>SLAM for Drones · GPS-denied field guide</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%231d1d1f'/%3E%3Cpath d='M8 8l16 16M8 24L24 8' stroke='white' stroke-width='3'/%3E%3C/svg%3E" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,100..900;1,62..125,100..900&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap" />
<style>
{css}
</style>
</head>
<body>
<div id="root"></div>
<script>
{js}
</script>
</body>
</html>
'''
os.makedirs('../drsirisha',exist_ok=True)
open('../drsirisha/index.html','w').write(html)
print(len(html))
