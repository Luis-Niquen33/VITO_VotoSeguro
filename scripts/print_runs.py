import json

def main():
    try:
        with open('runs.json', 'r', encoding='utf-8') as f:
            j = json.load(f)
    except Exception as e:
        print('error reading runs.json:', e)
        return
    runs = j.get('workflow_runs', [])
    for r in runs:
        print(r.get('id'), r.get('display_title'), r.get('status'), r.get('conclusion'))
    for r in runs:
        if r.get('conclusion') == 'success':
            print('\nSUCCESS HTML_URL:', r.get('html_url'))
            return
    print('\nNo successful runs found')

if __name__ == '__main__':
    main()
