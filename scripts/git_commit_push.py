import os, subprocess, sys
repo = r"C:\Users\artes\Documents\VITO\voto-seguro-eten\voto-seguro-eten"
print('Repo:', repo)
try:
    os.chdir(repo)
except Exception as e:
    print('chdir error', e); sys.exit(2)

def run(cmd):
    print('>',' '.join(cmd))
    r = subprocess.run(cmd, capture_output=True, text=True)
    print('rc', r.returncode)
    if r.stdout: print(r.stdout)
    if r.stderr: print(r.stderr)
    return r.returncode

run(['git','add','src/firebase.js'])
commit_rc = run(['git','commit','-m','fix(firebase): use VITE env and export db/isFirebaseConfigured'])
if commit_rc != 0:
    print('No commit created (maybe no changes)')
run(['git','push','origin','main'])
print('done')
