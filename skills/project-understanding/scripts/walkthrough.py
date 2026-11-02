"""检查动画步骤与架构图、数据样本的对应关系。"""


def validate_walkthroughs(pages, diagrams):
    by_id = {diagram['id']: diagram for diagram in diagrams}
    for page in pages.values():
        flow = page.get('walkthrough')
        if flow is None:
            continue
        if not isinstance(flow, dict):
            raise ValueError('walkthrough 必须是对象')
        diagram = by_id.get(flow.get('diagram'))
        if not diagram or page['id'] not in diagram['pages'] or diagram.get('after'):
            raise ValueError('动画必须使用当前页的顶部图')
        steps = flow.get('steps')
        if not isinstance(steps, list) or not steps:
            raise ValueError('动画步骤不能为空')
        if not isinstance(flow.get('evidence'), str) or not flow['evidence'].strip():
            raise ValueError('动画必须说明样本来源')
        node_ids = {node['id'] for node in diagram['nodes']}
        ids = set()
        for step in steps:
            if not isinstance(step, dict):
                raise ValueError('动画步骤必须是对象')
            for name in ('id', 'title', 'phase', 'text', 'evidence'):
                if not isinstance(step.get(name), str) or not step[name].strip():
                    raise ValueError(f'动画步骤缺少 {name}')
            if step['id'] in ids:
                raise ValueError('动画步骤 ID 重复')
            ids.add(step['id'])
            nodes, edges = step.get('nodes'), step.get('edges')
            if not isinstance(nodes, list) or not nodes or any(not isinstance(n, str) or n not in node_ids for n in nodes):
                raise ValueError('动画步骤引用无效节点')
            if not isinstance(edges, list) or any(type(i) is not int or not 0 <= i < len(diagram['edges']) for i in edges):
                raise ValueError('动画步骤引用无效连线')
            for side in ('input', 'output'):
                packet = step.get(side)
                if not isinstance(packet, dict) or not {'label', 'format', 'sample'} <= packet.keys():
                    raise ValueError('动画步骤缺少输入输出样本')
            screen = step.get('screen')
            if not isinstance(screen, dict) or not all(isinstance(screen.get(key), str) for key in ('title', 'text')):
                raise ValueError('动画步骤缺少可观察结果')
            if step.get('page') is not None and step['page'] not in pages:
                raise ValueError('动画步骤引用无效页面')
