import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import type { SlothConfig, ProviderEntry } from '../../core/config.js';
import { saveConfig, getAllProviderNames } from '../../core/config.js';
import { isPreset } from '../../providers/index.js';

type Step =
  | 'menu'
  | 'add-name'
  | 'add-type'
  | 'add-url'
  | 'add-model'
  | 'add-key'
  | 'add-thinking'
  | 'select-edit'
  | 'edit-field'
  | 'edit-value'
  | 'select-delete'
  | 'select-default'
  | 'set-thinking';

interface ConfigPanelProps {
  config: SlothConfig;
  onConfigSaved: (config: SlothConfig) => void;
  onClose: () => void;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, onConfigSaved, onClose }) => {
  const [step, setStep] = useState<Step>('menu');
  const [message, setMessage] = useState('');
  const [editName, setEditName] = useState('');
  const [editField, setEditField] = useState('');
  const [newProvider, setNewProvider] = useState<Partial<ProviderEntry & { name: string }>>({});
  const [input, setInput] = useState('');

  const showMsg = (msg: string) => { setMessage(msg); setInput(''); };

  const formatProviderList = () => {
    return getAllProviderNames(config).map((n, i) => {
      const p = config.providers[n];
      const tag = isPreset(n) ? '[preset]' : '[custom]';
      const model = p?.model ?? '';
      return `  ${i + 1}. ${n} ${tag} ${model ? `(${model})` : ''}`;
    }).join('\n');
  };

  const formatCustomProviders = () => {
    const customs = Object.keys(config.providers).filter(k => config.providers[k].type);
    if (customs.length === 0) return '  (无自定义 provider)';
    return customs.map((n, i) => `  ${i + 1}. ${n}`).join('\n');
  };

  const formatFullConfig = () => {
    const lines = [`默认 provider: ${config.provider}`];
    if (config.thinkingEffort) lines.push(`全局 thinking: ${config.thinkingEffort}`);
    lines.push('', 'Provider 列表:');
    for (const name of getAllProviderNames(config)) {
      const p = config.providers[name];
      const tag = isPreset(name) ? '[preset]' : '[custom]';
      lines.push(`  ${name} ${tag}`);
      if (p?.type) lines.push(`    type: ${p.type}`);
      if (p?.baseURL) lines.push(`    url: ${p.baseURL}`);
      if (p?.model) lines.push(`    model: ${p.model}`);
      if (p?.thinkingEffort) lines.push(`    thinking: ${p.thinkingEffort}`);
      if (p?.apiKey) lines.push(`    apiKey: ${p.apiKey.slice(0, 8)}...`);
    }
    return lines.join('\n');
  };

  const handleSubmit = useCallback((value: string) => {
    const v = value.trim();
    if (v === 'q' && step === 'menu') { onClose(); return; }

    switch (step) {
      case 'menu': {
        switch (v) {
          case '1': setStep('add-name'); setNewProvider({}); showMsg('输入新 provider 名称 (如 my-llm):'); break;
          case '2': setStep('select-edit'); showMsg('选择要编辑的 provider:\n' + formatProviderList()); break;
          case '3': setStep('select-delete'); showMsg('选择要删除的 provider:\n' + formatCustomProviders()); break;
          case '4': setStep('select-default'); showMsg('选择默认 provider:\n' + formatProviderList()); break;
          case '5': setStep('set-thinking'); showMsg('设置全局 thinking effort (low/medium/high 或留空取消):'); break;
          case '6': showMsg(formatFullConfig()); break;
          default: showMsg('无效选择，输入 1-6 或 q 返回');
        }
        break;
      }

      case 'add-name': {
        if (!v) { showMsg('名称不能为空'); return; }
        if (getAllProviderNames(config).includes(v)) { showMsg('该名称已存在'); return; }
        setNewProvider(prev => ({ ...prev, name: v }));
        setStep('add-type');
        showMsg('选择 API 类型:\n  1. openai-compat (兼容 OpenAI 接口)\n  2. anthropic (Anthropic 原生接口)');
        break;
      }

      case 'add-type': {
        const type = v === '1' ? 'openai-compat' as const : v === '2' ? 'anthropic' as const : null;
        if (!type) { showMsg('请输入 1 或 2'); return; }
        setNewProvider(prev => ({ ...prev, type }));
        setStep('add-url');
        showMsg(`输入 Base URL${type === 'openai-compat' ? ' (如 https://api.example.com/v1)' : ' (可留空使用默认)'}:`);
        break;
      }

      case 'add-url': {
        setNewProvider(prev => ({ ...prev, baseURL: v || undefined }));
        setStep('add-model');
        showMsg('输入模型名称 (如 gpt-4o, deepseek-chat):');
        break;
      }

      case 'add-model': {
        if (!v) { showMsg('模型名称不能为空'); return; }
        setNewProvider(prev => ({ ...prev, model: v }));
        setStep('add-key');
        showMsg('输入 API Key (留空则使用环境变量):');
        break;
      }

      case 'add-key': {
        setNewProvider(prev => ({ ...prev, apiKey: v || undefined }));
        setStep('add-thinking');
        showMsg('设置 thinking effort (low/medium/high，留空跳过):');
        break;
      }

      case 'add-thinking': {
        const effort = ['low', 'medium', 'high'].includes(v) ? v as 'low' | 'medium' | 'high' : undefined;
        const name = newProvider.name!;
        const updated = { ...config, providers: { ...config.providers } };
        updated.providers[name] = {
          type: newProvider.type as 'anthropic' | 'openai-compat',
          baseURL: newProvider.baseURL,
          model: newProvider.model,
          apiKey: newProvider.apiKey,
          thinkingEffort: effort,
        };
        saveConfig(updated).then(() => onConfigSaved(updated));
        setStep('menu');
        showMsg(`已添加 provider: ${name}`);
        break;
      }

      case 'select-edit': {
        const names = getAllProviderNames(config);
        const idx = parseInt(v) - 1;
        if (isNaN(idx) || idx < 0 || idx >= names.length) { showMsg('无效选择'); return; }
        const name = names[idx];
        setEditName(name);
        const p = config.providers[name] ?? {};
        setStep('edit-field');
        showMsg(`编辑 ${name}，选择字段:\n  1. model (当前: ${p.model || '默认'})\n  2. baseURL (当前: ${p.baseURL || '默认'})\n  3. apiKey\n  4. thinkingEffort (当前: ${p.thinkingEffort || '未设置'})\n  5. 返回`);
        break;
      }

      case 'edit-field': {
        const fieldMap: Record<string, string> = { '1': 'model', '2': 'baseURL', '3': 'apiKey', '4': 'thinkingEffort' };
        const field = fieldMap[v];
        if (!field) { setStep('menu'); setMessage(''); return; }
        setEditField(field);
        setStep('edit-value');
        showMsg(`输入新的 ${field} 值 (留空取消):`);
        break;
      }

      case 'edit-value': {
        if (!v) { setStep('menu'); setMessage(''); return; }
        const updated = { ...config, providers: { ...config.providers } };
        if (!updated.providers[editName]) updated.providers[editName] = {};
        if (editField === 'thinkingEffort' && ['low', 'medium', 'high'].includes(v)) {
          updated.providers[editName].thinkingEffort = v as 'low' | 'medium' | 'high';
        } else {
          (updated.providers[editName] as any)[editField] = v;
        }
        saveConfig(updated).then(() => onConfigSaved(updated));
        setStep('menu');
        showMsg(`已更新 ${editName}.${editField}`);
        break;
      }

      case 'select-delete': {
        const customs = Object.keys(config.providers).filter(k => config.providers[k].type);
        const idx = parseInt(v) - 1;
        if (isNaN(idx) || idx < 0 || idx >= customs.length) { showMsg('无效选择'); return; }
        const name = customs[idx];
        const updated = { ...config, providers: { ...config.providers } };
        delete updated.providers[name];
        saveConfig(updated).then(() => onConfigSaved(updated));
        setStep('menu');
        showMsg(`已删除 ${name}`);
        break;
      }

      case 'select-default': {
        const names = getAllProviderNames(config);
        const idx = parseInt(v) - 1;
        if (isNaN(idx) || idx < 0 || idx >= names.length) { showMsg('无效选择'); return; }
        const updated = { ...config, provider: names[idx] };
        saveConfig(updated).then(() => onConfigSaved(updated));
        setStep('menu');
        showMsg(`默认 provider 已设为: ${names[idx]}`);
        break;
      }

      case 'set-thinking': {
        if (!v) { setStep('menu'); setMessage(''); return; }
        if (!['low', 'medium', 'high'].includes(v)) { showMsg('无效值，请输入 low/medium/high'); return; }
        const updated = { ...config, thinkingEffort: v as 'low' | 'medium' | 'high' };
        saveConfig(updated).then(() => onConfigSaved(updated));
        setStep('menu');
        showMsg(`全局 thinking effort 已设为: ${v}`);
        break;
      }
    }
  }, [step, config, newProvider, editName, editField, onClose, onConfigSaved]);

  // Capture keyboard input
  useInput((keyInput, key) => {
    if (key.return) {
      handleSubmit(input);
      setInput('');
    } else if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
    } else if (key.escape) {
      if (step === 'menu') onClose();
      else { setStep('menu'); setMessage(''); setInput(''); }
    } else if (keyInput && !key.ctrl && !key.meta) {
      setInput(prev => prev + keyInput);
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text color="green" bold>配置管理</Text>
        <Text color="gray"> (ESC 返回, q 退出)</Text>
      </Box>

      {step === 'menu' && (
        <Box flexDirection="column">
          <Text color="cyan">选择操作:</Text>
          <Text>  1. 添加自定义 provider</Text>
          <Text>  2. 编辑 provider 配置</Text>
          <Text>  3. 删除自定义 provider</Text>
          <Text>  4. 切换默认 provider</Text>
          <Text>  5. 设置 thinking effort</Text>
          <Text>  6. 查看当前配置</Text>
        </Box>
      )}

      {message && (
        <Box flexDirection="column" marginTop={1}>
          <Text>{message}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="cyan">&gt; </Text>
        <Text>{input}</Text>
        <Text color="gray">_</Text>
      </Box>
    </Box>
  );
};
