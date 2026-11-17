"""Verify presence and sizes of a transferred docs bundle against a local inventory."""
import json,sys
from pathlib import Path
inventory=json.loads(Path(sys.argv[1]).read_text())['files'];root=Path(sys.argv[2]);missing=[];mismatched=[]
for name,size in inventory.items():
 p=root/name
 if not p.is_file():missing.append(name)
 elif p.stat().st_size!=size:mismatched.append(name)
result={'passed':not missing and not mismatched,'expectedFiles':len(inventory),'expectedBytes':sum(inventory.values()),'missingCount':len(missing),'sizeMismatchCount':len(mismatched),'missingExamples':missing[:10],'mismatchExamples':mismatched[:10],'scope':'File presence and sizes, not full-content checksums.'}
print(json.dumps(result,indent=2));sys.exit(0 if result['passed']else 1)
