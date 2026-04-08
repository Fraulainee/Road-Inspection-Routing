import argparse
import os
import openpyxl


def main():
    parser = argparse.ArgumentParser(description="Fill GravelInspection form template")
    parser.add_argument("--output", required=True, help="Output .xlsx file path")
    parser.add_argument("--date", default="")
    parser.add_argument("--rater", default="")
    parser.add_argument("--road_id", default="")
    parser.add_argument("--region", default="")
    parser.add_argument("--section_id", default="")
    parser.add_argument("--district", default="")
    parser.add_argument("--road_name", default="")
    parser.add_argument("--segment_length", default="")
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    template_path = os.path.join(script_dir, "FormGravel.xlsx")

    wb = openpyxl.load_workbook(template_path)
    sheet = wb.active

    sheet["AA1"] = args.date
    sheet["Z2"] = args.rater
    sheet["D5"] = args.road_id
    sheet["D6"] = args.region
    sheet["D7"] = args.section_id
    sheet["P5"] = args.district
    sheet["P6"] = args.road_name
    sheet["P7"] = args.segment_length

    wb.save(args.output)
    print("Saved:", args.output)


if __name__ == "__main__":
    main()