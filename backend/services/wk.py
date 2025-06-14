import sys
import json
import logging
from StorageD.codec import WukongEncode
import os

storageDParentPath = 'C:\\Users\\Multiplexon\\Desktop\\thesis\\Scoin - Copy\\Storage-D'
sys.path.append(storageDParentPath)

log = logging.getLogger('mylog')
if not log.hasHandlers():
    handler = logging.StreamHandler()
    log.addHandler(handler)
log.setLevel(logging.INFO)

def main():
    if len(sys.argv) < 10:
        print(json.dumps({"error": "Missing arguments"}))
        sys.exit(1)

    input_file_path = sys.argv[2]
    sequence_length = int(sys.argv[3])
    max_homopolymer = int(sys.argv[4])
    min_gc = float(sys.argv[5]) / 100
    max_gc = float(sys.argv[6]) / 100
    rs_num = int(sys.argv[7])
    add_primer = sys.argv[8].lower() == 'yes'
    add_redundancy = sys.argv[9].lower() == 'true'

    output_dir = "temp_output_dna_files"
    os.makedirs(output_dir, exist_ok=True)

    worker = WukongEncode(
        input_file_path=input_file_path,
        output_dir=output_dir,
        sequence_length=sequence_length,
        max_homopolymer=max_homopolymer,
        min_gc=min_gc,
        max_gc=max_gc,
        rule_num=1,
        rs_num=rs_num,
        add_redundancy=add_redundancy,
        add_primer=add_primer,
        primer_length=20
    )

    try:
        res_file = worker.common_encode()
        dna_strands = []
        if os.path.exists(res_file):
            with open(res_file) as f:
                dna_strands = [line.strip() for line in f]
            os.remove(res_file)
            try:
                os.rmdir(output_dir)
            except OSError:
                pass
        print(json.dumps({"dnaStrands": dna_strands}))
    except Exception as e:
        log.error(f"Error during encoding: {e}")
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()
