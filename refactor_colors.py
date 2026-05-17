import os
import re

replacements = [
    (r'bg-zinc-950', 'bg-bg-base'),
    (r'bg-zinc-900', 'bg-bg-surface'),
    (r'bg-zinc-800', 'bg-bg-elevated'),
    (r'bg-zinc-700', 'bg-bg-elevated'),
    (r'border-zinc-800', 'border-border-default'),
    (r'border-zinc-700', 'border-border-default'),
    (r'border-zinc-900', 'border-border-default'),
    (r'text-zinc-100', 'text-text-primary'),
    (r'text-zinc-200', 'text-text-primary'),
    (r'text-zinc-300', 'text-text-secondary'),
    (r'text-zinc-400', 'text-text-secondary'),
    (r'text-zinc-500', 'text-text-muted'),
    (r'text-zinc-600', 'text-text-muted'),
    (r'text-zinc-700', 'text-text-disabled'),
    (r'text-white', 'text-text-primary'),
    (r'text-black', 'text-text-primary'),
    (r'divide-zinc-800', 'divide-border-default'),
    (r'divide-zinc-700', 'divide-border-default'),
]

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    new_content = content
    for pattern, repl in replacements:
        new_content = re.sub(pattern, repl, new_content)
        
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            process_file(os.path.join(root, file))
