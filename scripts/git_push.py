import os
import subprocess

repo_path = r"c:/Users/artes/Documents/VITO/voto-seguro-eten/voto-seguro-eten"
print('CWD ->', repo_path)
os.chdir(repo_path)
# Stage files
subprocess.run(["git","add",".github/workflows/deploy.yml","README.md"]) 
# Commit (no error on no changes)
res = subprocess.run(["git","commit","-m","CI: inject Firebase env from Actions secrets; docs"], capture_output=True, text=True)
print('commit rc', res.returncode)
print(res.stdout)
print(res.stderr)
# Push
subprocess.run(["git","push","origin","main"]) 
print('Done')
