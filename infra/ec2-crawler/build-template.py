"""Build an EC2 template while preserving the running instance's boot identity."""
import argparse
import json
from pathlib import Path
import yaml


class Loader(yaml.SafeLoader):
    pass


for tag, key in [('Ref', 'Ref'), ('Sub', 'Fn::Sub'), ('And', 'Fn::And'),
                 ('Not', 'Fn::Not'), ('Equals', 'Fn::Equals')]:
    Loader.add_constructor('!' + tag, lambda loader, node, key=key: {
        key: loader.construct_sequence(node, deep=True) if isinstance(node, yaml.SequenceNode)
        else loader.construct_scalar(node)
    })


def build(template, bootstrap, image_id, existing=None):
    if not image_id.startswith('ami-'):
        raise ValueError('An explicit AMI ID is required')
    template['Parameters']['LatestAmiId']['Default'] = image_id
    instance = template['Resources']['Instance']['Properties']
    instance['UserData'] = existing['Resources']['Instance']['Properties']['UserData'] if existing else {
        'Fn::Base64': bootstrap
    }
    return template


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--image-id', required=True)
    parser.add_argument('--existing-template')
    args = parser.parse_args()
    existing = None
    if args.existing_template:
        existing = json.loads(Path(args.existing_template).read_text())['TemplateBody']
        if isinstance(existing, str):
            existing = yaml.load(existing, Loader=Loader)
    template = yaml.load(Path('infra/ec2-crawler/stack.yaml').read_text(), Loader=Loader)
    print(json.dumps(build(template, Path('infra/ec2-crawler/bootstrap.sh').read_text(), args.image_id, existing)))
